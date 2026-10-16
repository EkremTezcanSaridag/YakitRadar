from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from notification_rules import (
    confidence_meets_minimum,
    dedupe_price_changes,
    expected_change_dedupe_key,
    filter_expected_change_signals,
    istanbul_quiet_hours_active,
    is_pending_price_change_stale,
    is_single_source_low_confidence_signal,
    price_change_dedupe_key,
    should_notify_expected_change,
)

IST = ZoneInfo("Europe/Istanbul")


class TestQuietHours:
    def test_inside_quiet_window(self):
        assert istanbul_quiet_hours_active(datetime(2026, 10, 16, 23, 0, tzinfo=IST)) is True
        assert istanbul_quiet_hours_active(datetime(2026, 10, 16, 7, 30, tzinfo=IST)) is True

    def test_outside_quiet_window(self):
        assert istanbul_quiet_hours_active(datetime(2026, 10, 16, 8, 0, tzinfo=IST)) is False
        assert istanbul_quiet_hours_active(datetime(2026, 10, 16, 12, 0, tzinfo=IST)) is False


class TestExpectedChangeRules:
    def test_requires_medium_confidence_and_amount(self):
        row = {
            "confidence": "medium",
            "signals": [
                {
                    "fuel": "Motorin",
                    "direction": "increase",
                    "confidence": "medium",
                    "expected_amount_tl": 1.5,
                }
            ],
        }
        assert should_notify_expected_change(row, row["signals"][0]) is True

    def test_rejects_low_confidence(self):
        row = {
            "confidence": "low",
            "analysis": {"news_amount_extractions": [{"fuel": "Motorin", "source": "A"}]},
            "signals": [
                {
                    "fuel": "Motorin",
                    "direction": "increase",
                    "confidence": "low",
                    "expected_amount_tl": 2.0,
                }
            ],
        }
        assert should_notify_expected_change(row, row["signals"][0]) is False
        assert filter_expected_change_signals(row) == []

    def test_rejects_single_source_low_confidence_even_if_amount_present(self):
        row = {
            "confidence": "low",
            "analysis": {"news_amount_extractions": [{"fuel": "Benzin", "source": "only-one"}]},
            "signals": [
                {
                    "fuel": "Benzin",
                    "direction": "increase",
                    "confidence": "low",
                    "expected_amount_tl": 1.0,
                }
            ],
        }
        assert is_single_source_low_confidence_signal(row, row["signals"][0]) is True

    def test_dedupe_key_per_day_and_fuel(self):
        assert expected_change_dedupe_key("2026-10-16", "Motorin") == "expected:2026-10-16:motorin"


class TestPendingPriceStaleness:
    def test_fresh_row_not_stale(self):
        now = datetime(2026, 10, 16, 12, 0, tzinfo=IST)
        detected = (now - timedelta(hours=1)).isoformat()
        assert is_pending_price_change_stale(detected, now) is False

    def test_row_older_than_24h_is_stale(self):
        now = datetime(2026, 10, 16, 12, 0, tzinfo=IST)
        detected = (now - timedelta(hours=25)).isoformat()
        assert is_pending_price_change_stale(detected, now) is True

    def test_boundary_exactly_24h_not_stale(self):
        now = datetime(2026, 10, 16, 12, 0, tzinfo=IST)
        detected = now - timedelta(hours=24)
        assert is_pending_price_change_stale(detected, now) is False

    def test_missing_or_invalid_detected_at_is_stale(self):
        now = datetime(2026, 10, 16, 12, 0, tzinfo=IST)
        assert is_pending_price_change_stale(None, now) is True
        assert is_pending_price_change_stale("", now) is True
        assert is_pending_price_change_stale("not-a-date", now) is True


class TestPriceChangeDedupe:
    def test_dedupe_key_stable(self):
        change = {
            "city": "Ankara",
            "fuel": "Motorin",
            "old_price": 50.0,
            "new_price": 51.0,
        }
        assert price_change_dedupe_key(change, "2026-10-16") == "price:2026-10-16:ankara:motorin:50.0:51.0"

    def test_merge_duplicate_changes(self):
        changes = [
            {"city": "Ankara", "fuel": "Motorin", "old_price": 50.0, "new_price": 51.0},
            {"city": "Ankara", "fuel": "Motorin", "old_price": 50.0, "new_price": 51.0},
            {"city": "Izmir", "fuel": "Benzin", "old_price": 49.0, "new_price": 49.5},
        ]
        merged = dedupe_price_changes(changes, "2026-10-16")
        assert len(merged) == 2

    def test_confidence_rank(self):
        assert confidence_meets_minimum("high", "medium") is True
        assert confidence_meets_minimum("medium", "medium") is True
        assert confidence_meets_minimum("low", "medium") is False
