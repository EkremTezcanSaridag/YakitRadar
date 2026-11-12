"""Tests for scraped price guards and source validation."""

from unittest.mock import MagicMock, patch

import pytest
from bs4 import BeautifulSoup

from price_scrape_guard import (
    BULK_PRICE_DEVIATION_RATIO,
    FIELD_DEVIATION_RATIOS,
    LPG_BULK_PRICE_DEVIATION_RATIO,
    PriceSanityError,
    PriceSourceValidationError,
    apply_price_sanity_guard,
    assert_bulk_price_deviation_ok,
    assert_scraped_city_count,
    bulk_deviation_stats,
    evaluate_bulk_price_deviation,
    is_price_sanity_override_enabled,
    price_sanity_warnings,
    validate_aytemiz_akaryakit_page,
    validate_gecmis_daily_deltas,
)
from fiyat_servisi import gecmis_kaydet


def _city_rows(price: str, count: int = 81) -> dict:
    return {
        f"Il-{index}": {
            "il": f"Il-{index}",
            "benzin_95": price,
            "motorin": price,
            "lpg": "30,00",
            "guncelleme": "2026-10-18 12:00",
        }
        for index in range(count)
    }


def _fuel_rows(benzin: str, motorin: str, lpg: str, count: int = 4) -> dict:
    return {
        f"Il-{index}": {
            "il": f"Il-{index}",
            "benzin_95": benzin,
            "motorin": motorin,
            "lpg": lpg,
            "guncelleme": "2026-10-18 12:00",
        }
        for index in range(count)
    }


class TestBulkDeviation:
    def test_majority_deviation_raises(self):
        previous = _city_rows("85,00")
        new = _city_rows("64,00")

        with pytest.raises(PriceSanityError):
            assert_bulk_price_deviation_ok(previous, new)

    def test_normal_daily_change_passes(self):
        previous = _city_rows("85,00")
        new = dict(previous)
        new["Il-0"] = {**new["Il-0"], "benzin_95": "85,50"}

        assert_bulk_price_deviation_ok(previous, new)

    def test_override_allows_majority_deviation(self):
        previous = _city_rows("85,00")
        new = _city_rows("64,00")

        assert_bulk_price_deviation_ok(previous, new, env={"PRICE_SANITY_OVERRIDE": "1"})

    def test_skips_when_no_previous_data(self):
        assert_bulk_price_deviation_ok({}, _city_rows("64,00"))

    def test_stats_threshold(self):
        previous = _city_rows("100,00", count=4)
        new = {
            "Il-0": {**previous["Il-0"], "benzin_95": "120,00"},
            "Il-1": {**previous["Il-1"], "benzin_95": "120,00"},
            "Il-2": {**previous["Il-2"], "benzin_95": "101,00"},
            "Il-3": {**previous["Il-3"], "benzin_95": "100,50"},
        }
        stats = bulk_deviation_stats(previous, new, "benzin_95")
        assert stats["deviating"] == 2
        assert stats["comparable"] == 4
        assert stats["deviating_share"] == 0.5


class TestPerFuelDeviationPolicy:
    def test_lpg_has_wider_ratio_window(self):
        assert FIELD_DEVIATION_RATIOS["benzin_95"] == BULK_PRICE_DEVIATION_RATIO
        assert FIELD_DEVIATION_RATIOS["motorin"] == BULK_PRICE_DEVIATION_RATIO
        assert FIELD_DEVIATION_RATIOS["lpg"] == LPG_BULK_PRICE_DEVIATION_RATIO

    def test_lpg_22_percent_jump_passes(self):
        previous = _fuel_rows("85,00", "85,00", "41,00")
        new = _fuel_rows("85,00", "85,00", "50,20")

        sanitized, report = apply_price_sanity_guard(previous, new)

        assert report["blocked_fields"] == []
        assert sanitized["Il-0"]["lpg"] == "50,20"

    def test_partial_block_keeps_previous_field(self):
        previous = _fuel_rows("85,00", "85,00", "41,00")
        new = _fuel_rows("64,00", "85,00", "41,00")

        sanitized, report = apply_price_sanity_guard(previous, new)

        assert report["blocked_fields"] == ["benzin_95"]
        assert all(row["benzin_95"] == "85,00" for row in sanitized.values())
        assert all(row["motorin"] == "85,00" for row in sanitized.values())
        assert all(row["lpg"] == "41,00" for row in sanitized.values())

    def test_all_fields_blocked_is_reported(self):
        previous = _fuel_rows("85,00", "85,00", "41,00")
        new = _fuel_rows("64,00", "64,00", "30,00")

        report = evaluate_bulk_price_deviation(previous, new)

        assert set(report["blocked_fields"]) == {"benzin_95", "motorin", "lpg"}
        with pytest.raises(PriceSanityError):
            assert_bulk_price_deviation_ok(previous, new)

    def test_override_keeps_all_new_values(self):
        previous = _fuel_rows("85,00", "85,00", "41,00")
        new = _fuel_rows("64,00", "64,00", "30,00")

        sanitized, report = apply_price_sanity_guard(
            previous, new, env={"PRICE_SANITY_OVERRIDE": "1"}
        )

        assert report["blocked_fields"] == []
        assert sanitized["Il-0"]["benzin_95"] == "64,00"

    def test_new_city_without_previous_keeps_scraped_value(self):
        previous = {"Il-0": _fuel_rows("85,00", "85,00", "41,00", count=1)["Il-0"]}
        new = _fuel_rows("64,00", "85,00", "41,00", count=2)

        sanitized, report = apply_price_sanity_guard(previous, new)

        assert report["blocked_fields"] == ["benzin_95"]
        assert sanitized["Il-0"]["benzin_95"] == "85,00"
        assert sanitized["Il-1"]["benzin_95"] == "64,00"

    def test_warnings_name_blocked_field_and_threshold(self):
        previous = _fuel_rows("85,00", "85,00", "41,00")
        new = _fuel_rows("64,00", "85,00", "41,00")
        _, report = apply_price_sanity_guard(previous, new)

        warnings = price_sanity_warnings(report)

        assert len(warnings) == 1
        assert "benzin_95" in warnings[0]
        assert "10" in warnings[0]


class TestSourceValidation:
    def test_valid_akaryakit_header_order(self):
        html = """
        <table>
          <thead><tr><th>Il</th><th>Benzin</th><th>Motorin</th><th>Kursunsuz</th></tr></thead>
        </table>
        """
        validate_aytemiz_akaryakit_page(BeautifulSoup(html, "html.parser"))

    def test_rejects_reversed_columns(self):
        html = """
        <table>
          <thead><tr><th>Il</th><th>Motorin</th><th>Benzin</th></tr></thead>
        </table>
        """
        with pytest.raises(PriceSourceValidationError):
            validate_aytemiz_akaryakit_page(BeautifulSoup(html, "html.parser"))

    def test_city_count_minimum(self):
        with pytest.raises(PriceSourceValidationError):
            assert_scraped_city_count(70)


class TestGecmisGuard:
    def test_rejects_large_daily_delta(self):
        with pytest.raises(PriceSanityError):
            validate_gecmis_daily_deltas(9.0, 0.0, 0.0, 8.0)

    def test_lpg_uses_wider_daily_limit(self):
        validate_gecmis_daily_deltas(0.0, 0.0, 9.3, 8.0, lpg_max_daily_change=12.0)

    def test_lpg_still_rejects_beyond_wider_limit(self):
        with pytest.raises(PriceSanityError):
            validate_gecmis_daily_deltas(0.0, 0.0, 12.5, 8.0, lpg_max_daily_change=12.0)

    def test_override_skips_daily_delta_guard(self):
        validate_gecmis_daily_deltas(
            20.0, 20.0, 20.0, 8.0, env={"PRICE_SANITY_OVERRIDE": "1"}
        )

    @patch("fiyat_servisi.supabase")
    def test_gecmis_kaydet_allows_lpg_jump_below_lpg_limit(self, mock_supabase):
        veri = _fuel_rows("64,00", "64,00", "51,00", count=10)

        onceki = MagicMock()
        onceki.data = [{"benzin_95": "64.0", "motorin": "64.0", "lpg": "41.68"}]

        bugunku = MagicMock()
        bugunku.data = []

        table = MagicMock()
        table.select.return_value = table
        table.lt.return_value = table
        table.order.return_value = table
        table.limit.return_value = table
        table.eq.return_value = table
        table.execute.side_effect = [onceki, bugunku]

        mock_supabase.table.return_value = table

        gecmis_kaydet(veri)

        table.insert.assert_called_once()

    @patch("fiyat_servisi.supabase")
    def test_gecmis_kaydet_does_not_write_on_large_delta(self, mock_supabase):
        veri = _city_rows("64,00", count=10)

        onceki = MagicMock()
        onceki.data = [{"benzin_95": "85.0", "motorin": "85.0", "lpg": "40.0"}]

        bugunku = MagicMock()
        bugunku.data = []

        table = MagicMock()
        table.select.return_value = table
        table.lt.return_value = table
        table.order.return_value = table
        table.limit.return_value = table
        table.eq.return_value = table
        table.execute.side_effect = [onceki, bugunku]

        mock_supabase.table.return_value = table

        with pytest.raises(PriceSanityError):
            gecmis_kaydet(veri)

        table.insert.assert_not_called()
        table.update.assert_not_called()


class TestOverrideFlag:
    def test_override_enabled(self):
        assert is_price_sanity_override_enabled({"PRICE_SANITY_OVERRIDE": "1"})
        assert not is_price_sanity_override_enabled({})
