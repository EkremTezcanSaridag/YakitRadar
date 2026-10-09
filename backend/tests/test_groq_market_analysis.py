"""Unit tests for groq_market_analysis helpers."""

from datetime import datetime, timedelta, timezone

import pytest

from groq_market_analysis import (
    NO_CHANGE_SUMMARY,
    aggregate_news_amount_extractions,
    build_fallback_signal_summary,
    build_mobile_fuel_signals,
    compute_bu_gece_effective_at,
    enrich_news_item,
    extract_price_amounts,
    is_bu_gece_already_applied,
    parse_expected_amount_tl,
    parse_groq_fuel_signals,
    resolve_market_summary,
    strip_news_title_source_suffix,
    validate_groq_summary,
)
from market_signals import normalize_text

REAL_HEADLINES = [
    (
        "bu gece yarısından itibaren geçerli olmak üzere motorine 6,40 TL zam, "
        "benzine ise 96 kuruş indirim"
    ),
    ("benzine 96 kuruşluk indirim, motorine ise 6,40 liralık zam"),
    (
        "motorinin litre fiyatına 6 lira 40 kuruş zam… benzinde ise "
        "96 kuruşluk indirim"
    ),
]


def signals_by_fuel(extractions):
    return {
        (entry["fuel"], entry["direction"]): entry["signed_amount_tl"]
        for entry in extractions
    }


class TestRealHeadlineExtraction:
    @pytest.mark.parametrize("headline", REAL_HEADLINES)
    def test_benzin_and_motorin_amounts(self, headline):
        extracted = extract_price_amounts(headline, normalize_text)
        by_key = signals_by_fuel(extracted)

        assert by_key.get(("Benzin", "decrease")) == -0.96
        assert by_key.get(("Motorin", "increase")) == 6.4

    def test_fourth_headline_motorin_only(self):
        extracted = extract_price_amounts("motorine 6,75 TL zam", normalize_text)
        by_key = signals_by_fuel(extracted)

        assert by_key.get(("Motorin", "increase")) == 6.75


class TestAggregateNewsAmounts:
    def test_majority_when_sources_disagree(self):
        news_items = [
            {
                "title": "a",
                "extracted_amounts": [
                    {
                        "fuel": "Motorin",
                        "direction": "increase",
                        "amount_tl": 6.4,
                        "signed_amount_tl": 6.4,
                    }
                ],
            },
            {
                "title": "b",
                "extracted_amounts": [
                    {
                        "fuel": "Motorin",
                        "direction": "increase",
                        "amount_tl": 6.4,
                        "signed_amount_tl": 6.4,
                    }
                ],
            },
            {
                "title": "c",
                "extracted_amounts": [
                    {
                        "fuel": "Motorin",
                        "direction": "increase",
                        "amount_tl": 6.75,
                        "signed_amount_tl": 6.75,
                    }
                ],
            },
        ]
        aggregated, disagreed = aggregate_news_amount_extractions(news_items)

        motorin = next(item for item in aggregated if item["fuel"] == "Motorin")
        assert motorin["amount_tl"] == 6.4
        assert disagreed is True


class TestParseExpectedAmountTl:
    def test_parses_comma_decimal(self):
        assert parse_expected_amount_tl("1,49") == 1.49

    def test_invalid_returns_none(self):
        assert parse_expected_amount_tl("yaklaşık") is None


class TestParseGroqFuelSignals:
    def test_expected_price_computed_in_code(self):
        extractions = [
            {
                "fuel": "Motorin",
                "direction": "increase",
                "amount_tl": 1.49,
                "signed_amount_tl": 1.49,
            }
        ]
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
        signals = parse_groq_fuel_signals(parsed, current, extractions)
        motorin = next(s for s in signals if s["fuel"] == "Motorin")

        assert motorin["expected_amount_tl"] == 1.49
        assert motorin["expected_price"] == 93.5

    def test_groq_null_uses_unique_extraction(self):
        extractions = [
            {
                "fuel": "Motorin",
                "direction": "increase",
                "amount_tl": 6.4,
                "signed_amount_tl": 6.4,
            }
        ]
        parsed = {
            "signals": [
                {
                    "fuel": "Motorin",
                    "direction": "increase",
                    "expected_amount_tl": None,
                    "reason": "haber",
                }
            ]
        }
        signals = parse_groq_fuel_signals(
            parsed,
            {"Benzin": 1.0, "Motorin": 2.0, "LPG": 3.0},
            extractions,
        )
        motorin = next(s for s in signals if s["fuel"] == "Motorin")

        assert motorin["expected_amount_tl"] == 6.4


class TestGroqSummaryValidation:
    @pytest.fixture
    def mixed_signals(self):
        return [
            {
                "fuel": "Motorin",
                "direction": "increase",
                "expected_amount_tl": 6.4,
            },
            {
                "fuel": "Benzin",
                "direction": "decrease",
                "expected_amount_tl": -0.96,
            },
            {"fuel": "LPG", "direction": "neutral", "expected_amount_tl": None},
        ]

    def test_valid_groq_summary_accepted(self, mixed_signals):
        groq = "Motorin ↑ 6,40 TL; Benzin ↓ 0,96 TL"

        assert validate_groq_summary(groq, mixed_signals) is True
        assert resolve_market_summary(groq, mixed_signals) == groq

    def test_too_long_summary_uses_fallback(self, mixed_signals):
        groq = "Motorin ↑ 6,40 TL; Benzin ↓ 0,96 TL " + ("x" * 200)

        assert validate_groq_summary(groq, mixed_signals) is False
        assert (
            resolve_market_summary(groq, mixed_signals)
            == "Motorin ↑ 6,40 TL; Benzin ↓ 0,96 TL"
        )

    def test_contradicting_direction_uses_fallback(self, mixed_signals):
        groq = "Motorin ↓ 6,40 TL; Benzin ↓ 0,96 TL"

        assert validate_groq_summary(groq, mixed_signals) is False
        assert "Motorin ↑" in resolve_market_summary(groq, mixed_signals)

    def test_contradicting_amount_uses_fallback(self, mixed_signals):
        groq = "Motorin ↑ 6,75 TL; Benzin ↓ 0,96 TL"

        assert validate_groq_summary(groq, mixed_signals) is False
        assert "6,40 TL" in resolve_market_summary(groq, mixed_signals)

    def test_no_change_summary(self):
        neutral = [
            {"fuel": "Motorin", "direction": "neutral", "expected_amount_tl": None},
            {"fuel": "Benzin", "direction": "neutral", "expected_amount_tl": None},
            {"fuel": "LPG", "direction": "neutral", "expected_amount_tl": None},
        ]

        assert validate_groq_summary(NO_CHANGE_SUMMARY, neutral) is True
        assert build_fallback_signal_summary(neutral) == NO_CHANGE_SUMMARY


class TestStripNewsTitleSourceSuffix:
    def test_strips_trailing_source(self):
        assert strip_news_title_source_suffix("Motorine zam - Habertürk") == "Motorine zam"


IST = timezone(timedelta(hours=3))


class TestBuGeceEffectiveAt:
    def test_evening_reference_targets_next_midnight(self):
        ref = datetime(2026, 10, 9, 20, 0, tzinfo=IST)
        effective = compute_bu_gece_effective_at(ref, timing="Bu gece yarısı")

        assert effective == datetime(2026, 10, 10, 0, 0, tzinfo=IST)

    def test_morning_reference_same_day_midnight(self):
        ref = datetime(2026, 10, 9, 9, 0, tzinfo=IST)
        effective = compute_bu_gece_effective_at(ref, timing="bu gece")

        assert effective == datetime(2026, 10, 9, 0, 0, tzinfo=IST)

    def test_build_mobile_signal_includes_effective_at(self):
        parsed = [
            {
                "fuel": "Motorin",
                "direction": "increase",
                "expected_amount": 6.4,
                "expected_amount_tl": 6.4,
                "timing": "Bu gece yarısı",
            }
        ]
        ref = datetime(2026, 10, 9, 20, 0, tzinfo=IST)
        mobile = build_mobile_fuel_signals(parsed, "high", 90, timing="Bu gece yarısı", reference_time=ref)
        motorin = next(item for item in mobile if item["fuel"] == "Motorin")

        assert motorin["expected_amount_tl"] == 6.4
        assert motorin["effective_at"] == datetime(2026, 10, 10, 0, 0, tzinfo=IST).isoformat()


class TestEnrichBuGeceAging:
    def test_bu_gece_before_midnight_not_marked_applied(self):
        now = datetime(2026, 10, 9, 23, 0, tzinfo=IST)
        published = datetime(2026, 10, 9, 18, 0, tzinfo=IST)
        item = {
            "title": "Bu gece motorine zam",
            "published_at_parsed": published,
        }
        enriched = enrich_news_item(item, now, normalize_text)

        assert enriched["bu_gece_already_applied"] is False

    def test_bu_gece_after_midnight_marked_applied(self):
        now = datetime(2026, 10, 10, 8, 0, tzinfo=IST)
        published = datetime(2026, 10, 9, 18, 0, tzinfo=IST)
        title = "Bu gece motorine zam"

        assert is_bu_gece_already_applied(normalize_text(title), published, now) is True
