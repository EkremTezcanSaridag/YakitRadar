"""Unit tests for groq_market_analysis helpers."""

from datetime import datetime, timedelta, timezone

import pytest

from groq_market_analysis import (
    build_numeric_summary_from_signals,
    parse_expected_amount_tl,
    parse_groq_fuel_signals,
    strip_news_title_source_suffix,
)


class TestParseExpectedAmountTl:
    def test_parses_comma_decimal(self):
        assert parse_expected_amount_tl("1,49") == 1.49

    def test_parses_float(self):
        assert parse_expected_amount_tl(2.5) == 2.5

    def test_invalid_returns_none(self):
        assert parse_expected_amount_tl("yaklaşık") is None
        assert parse_expected_amount_tl(None) is None
        assert parse_expected_amount_tl(True) is None


class TestParseGroqFuelSignals:
    def test_expected_price_computed_in_code(self):
        parsed = {
            "signals": [
                {
                    "fuel": "Motorin",
                    "direction": "increase",
                    "expected_amount_tl": 1.49,
                    "reason": "Ekonomim",
                }
            ]
        }
        current = {"Benzin": 50.0, "Motorin": 92.01, "LPG": 30.0}
        signals = parse_groq_fuel_signals(parsed, current)
        motorin = next(s for s in signals if s["fuel"] == "Motorin")

        assert motorin["expected_amount_tl"] == 1.49
        assert motorin["current_price"] == 92.01
        assert motorin["expected_price"] == 93.5

    def test_null_amount_stays_null(self):
        parsed = {
            "signals": [
                {
                    "fuel": "Motorin",
                    "direction": "increase",
                    "expected_amount_tl": None,
                    "reason": "spekülasyon",
                }
            ]
        }
        current = {"Benzin": 50.0, "Motorin": 92.01, "LPG": 30.0}
        signals = parse_groq_fuel_signals(parsed, current)
        motorin = next(s for s in signals if s["fuel"] == "Motorin")

        assert motorin["expected_amount_tl"] is None
        assert motorin["expected_price"] is None
        assert motorin["direction"] == "increase"

    def test_invalid_signals_become_neutral(self):
        parsed = {"signals": [{"fuel": "Diesel", "direction": "increase", "expected_amount_tl": 5}]}
        current = {"Benzin": 50.0, "Motorin": 92.0, "LPG": 30.0}
        signals = parse_groq_fuel_signals(parsed, current)

        assert all(signal["direction"] == "neutral" for signal in signals)
        assert all(signal["expected_amount_tl"] is None for signal in signals)

    def test_missing_signals_list_is_neutral(self):
        signals = parse_groq_fuel_signals({}, {"Benzin": 1.0, "Motorin": 2.0, "LPG": 3.0})

        assert len(signals) == 3
        assert all(s["direction"] == "neutral" for s in signals)


class TestBuildNumericSummary:
    def test_summary_contains_prices_and_delta(self):
        signals = [
            {
                "fuel": "Motorin",
                "direction": "increase",
                "current_price": 92.01,
                "expected_amount_tl": 1.49,
                "expected_price": 93.5,
                "reason": "X haberi",
            }
        ]
        summary = build_numeric_summary_from_signals(signals)

        assert summary is not None
        assert "Motorin" in summary
        assert "92,01" in summary
        assert "93,50" in summary
        assert "+1,49" in summary
        assert "X haberi" in summary

    def test_no_numeric_candidate_returns_none(self):
        signals = [
            {
                "fuel": "Motorin",
                "direction": "neutral",
                "current_price": 92.01,
                "expected_amount_tl": None,
                "expected_price": None,
                "reason": "",
            }
        ]

        assert build_numeric_summary_from_signals(signals) is None


class TestStripNewsTitleSourceSuffix:
    def test_strips_trailing_source(self):
        title = "Motorine zam - Habertürk"
        assert strip_news_title_source_suffix(title) == "Motorine zam"

    def test_dedup_uses_stripped_title(self):
        from market_signals import normalize_text

        a = normalize_text(strip_news_title_source_suffix("Motorine zam - Habertürk"))
        b = normalize_text(strip_news_title_source_suffix("Motorine zam - NTV"))

        assert a == b


class TestEnrichBuGeceAging:
    def test_bu_gece_before_midnight_marked_applied(self):
        from groq_market_analysis import enrich_news_item
        from market_signals import ISTANBUL_TZ, normalize_text

        now = datetime(2026, 10, 9, 10, 0, tzinfo=ISTANBUL_TZ)
        yesterday_evening = datetime(2026, 10, 8, 22, 0, tzinfo=ISTANBUL_TZ)
        item = {
            "title": "Motorine bu gece zam bekleniyor",
            "published_at_parsed": yesterday_evening,
        }
        enriched = enrich_news_item(item, now, normalize_text)

        assert enriched["bu_gece_already_applied"] is True
