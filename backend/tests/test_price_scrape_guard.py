"""Tests for scraped price guards and source validation."""

from unittest.mock import MagicMock, patch

import pytest
from bs4 import BeautifulSoup

from price_scrape_guard import (
    BULK_PRICE_DEVIATION_RATIO,
    PriceSanityError,
    PriceSourceValidationError,
    assert_bulk_price_deviation_ok,
    assert_scraped_city_count,
    bulk_deviation_stats,
    is_price_sanity_override_enabled,
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
