"""Phrase-level tests for news amount extraction (real publisher wording)."""

import json
from pathlib import Path

import pytest

from groq_market_analysis import extract_price_amounts
from market_signals import normalize_text

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "publisher_news_snippets.json"


def signals_by_fuel(extractions):
    return {
        (entry["fuel"], entry["direction"]): entry["signed_amount_tl"]
        for entry in extractions
    }


def load_fixtures():
    return json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))


class TestTurkishAmountPhrases:
    @pytest.mark.parametrize(
        "phrase, fuel, direction, amount",
        [
            ("motorine 6,40 TL zam", "Motorin", "increase", 6.4),
            ("litre başına 6,40 TL zam motorine", "Motorin", "increase", 6.4),
            ("motorine 6.40 liralık zam", "Motorin", "increase", 6.4),
            ("benzine 96 kuruş indirim", "Benzin", "decrease", -0.96),
            ("benzine 96 kuruşluk indirim", "Benzin", "decrease", -0.96),
            ("motorine 6 lira 40 kuruş zam", "Motorin", "increase", 6.4),
        ],
    )
    def test_single_phrase(self, phrase, fuel, direction, amount):
        extracted = extract_price_amounts(phrase, normalize_text)
        by_key = signals_by_fuel(extracted)

        assert by_key.get((fuel, direction)) == amount


class TestMixedFuelSentenceOrder:
    @pytest.mark.parametrize(
        "sentence",
        [
            "benzine 96 kuruş indirim, motorine 6,40 TL zam",
            "motorine 6,40 TL zam, benzine 96 kuruş indirim",
            "benzine 96 kuruşluk indirim, motorine ise 6,40 liralık zam",
        ],
    )
    def test_benzin_and_motorin_not_swapped(self, sentence):
        extracted = extract_price_amounts(sentence, normalize_text)
        by_key = signals_by_fuel(extracted)

        assert by_key.get(("Motorin", "increase")) == 6.4
        assert by_key.get(("Benzin", "decrease")) == -0.96


class TestPublisherFixtureSnippets:
    def test_ekonomim_rss_lead_extracts_both_fuels(self):
        fixtures = load_fixtures()
        extracted = extract_price_amounts(fixtures["ekonomim_rss_lead"], normalize_text)
        by_key = signals_by_fuel(extracted)

        assert by_key.get(("Motorin", "increase")) == 6.4
        assert by_key.get(("Benzin", "decrease")) == -0.96

    def test_ekonomim_article_body_extracts_both_fuels(self):
        fixtures = load_fixtures()
        extracted = extract_price_amounts(fixtures["ekonomim_article_body"], normalize_text)
        by_key = signals_by_fuel(extracted)

        assert by_key.get(("Motorin", "increase")) == 6.4
        assert by_key.get(("Benzin", "decrease")) == -0.96
