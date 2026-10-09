"""Unit tests for groq_market_analysis helpers."""

from datetime import datetime

import pytest

from groq_market_analysis import (
    aggregate_news_amount_extractions,
    build_deterministic_market_summary,
    extract_price_amounts,
    parse_expected_amount_tl,
    parse_groq_fuel_signals,
    strip_news_title_source_suffix,
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


class TestDeterministicSummary:
    def test_mixed_fuels_one_sentence(self):
        signals = [
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

        assert (
            build_deterministic_market_summary(signals)
            == "Motorin 6,40 lira artacak, benzin 96 kuruş düşecek."
        )

    def test_all_neutral(self):
        signals = [
            {"fuel": "Motorin", "direction": "neutral", "expected_amount_tl": None},
            {"fuel": "Benzin", "direction": "neutral", "expected_amount_tl": None},
            {"fuel": "LPG", "direction": "neutral", "expected_amount_tl": None},
        ]

        assert build_deterministic_market_summary(signals) == "Fiyat değişikliği beklenmiyor."


class TestStripNewsTitleSourceSuffix:
    def test_strips_trailing_source(self):
        assert strip_news_title_source_suffix("Motorine zam - Habertürk") == "Motorine zam"
