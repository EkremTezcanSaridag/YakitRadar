"""Tests for price memory item validation."""

from price_memory_validation import (
    MAX_MEMORY_AVERAGE_DIFF,
    normalize_memory_fuel,
    parse_finite_average_diff,
    sanitize_mobile_fuel_signals,
    sanitize_price_memory_item,
    sanitize_price_memory_items,
)


class TestNormalizeMemoryFuel:
    def test_allowed_fuels(self):
        assert normalize_memory_fuel("Benzin") == "Benzin"
        assert normalize_memory_fuel("Motorin") == "Motorin"
        assert normalize_memory_fuel("LPG") == "LPG"

    def test_lpg_aliases(self):
        assert normalize_memory_fuel("LPG (Otogaz)") == "LPG"
        assert normalize_memory_fuel("Otogaz") == "LPG"

    def test_rejects_unknown(self):
        assert normalize_memory_fuel("Diesel") is None
        assert normalize_memory_fuel("") is None
        assert normalize_memory_fuel(None) is None


class TestParseFiniteAverageDiff:
    def test_accepts_numbers(self):
        assert parse_finite_average_diff(1.5) == 1.5
        assert parse_finite_average_diff("-2,50") == -2.5

    def test_rejects_non_finite(self):
        assert parse_finite_average_diff(float("inf")) is None
        assert parse_finite_average_diff("not-a-number") is None
        assert parse_finite_average_diff(True) is None


class TestSanitizePriceMemoryItem:
    def test_valid_item(self):
        item = {"fuel": "Benzin", "average_diff": 0.45, "city_count": 3}
        result = sanitize_price_memory_item(item)

        assert result == {"fuel": "Benzin", "average_diff": 0.45, "city_count": 3}

    def test_normalizes_lpg_alias(self, capsys):
        item = {"fuel": "LPG (Otogaz)", "average_diff": 1.0}
        result = sanitize_price_memory_item(item)

        assert result["fuel"] == "LPG"
        assert capsys.readouterr().out == ""

    def test_rejects_invalid_fuel(self, capsys):
        assert sanitize_price_memory_item({"fuel": "Kerosene", "average_diff": 1}) is None
        assert "UYARI" in capsys.readouterr().out

    def test_rejects_diff_over_limit(self, capsys):
        over = MAX_MEMORY_AVERAGE_DIFF + 0.01
        assert sanitize_price_memory_item({"fuel": "Motorin", "average_diff": over}) is None
        assert "sinir disi" in capsys.readouterr().out

    def test_accepts_boundary_diff(self):
        assert sanitize_price_memory_item({"fuel": "LPG", "average_diff": -10}) is not None
        assert sanitize_price_memory_item({"fuel": "LPG", "average_diff": 10}) is not None

    def test_rejects_non_object(self, capsys):
        assert sanitize_price_memory_item("bad") is None
        assert "UYARI" in capsys.readouterr().out


class TestSanitizePriceMemoryItems:
    def test_filters_invalid_entries(self, capsys):
        items = [
            {"fuel": "Benzin", "average_diff": 0.5},
            {"fuel": "Hack", "average_diff": 99},
            {"fuel": "Motorin", "average_diff": 2},
        ]

        result = sanitize_price_memory_items(items)

        assert len(result) == 2
        assert result[0]["fuel"] == "Benzin"
        assert result[1]["fuel"] == "Motorin"
        assert "UYARI" in capsys.readouterr().out

    def test_empty_input(self):
        assert sanitize_price_memory_items([]) == []
        assert sanitize_price_memory_items(None) == []


class TestSanitizeMobileFuelSignals:
    def test_normalizes_lpg_alias(self):
        signals = [
            {"fuel": "Otogaz", "direction": "neutral", "score": 0},
            {"fuel": "Benzin", "direction": "increase", "score": 90},
        ]

        result = sanitize_mobile_fuel_signals(signals)

        assert result[0]["fuel"] == "LPG"
        assert result[1]["fuel"] == "Benzin"

    def test_drops_invalid_fuel(self, capsys):
        result = sanitize_mobile_fuel_signals([{"fuel": "Diesel", "direction": "increase"}])

        assert result == []
        assert "UYARI" in capsys.readouterr().out


class TestMergePriceMemoryIntegration:
    def test_merge_price_memory_sanitizes_previous_items(self):
        from market_signals import merge_price_memory

        current = {
            "score": 0,
            "direction": "neutral",
            "summary": "neutral",
            "items": [],
        }
        previous = {
            "score": 40,
            "direction": "increase",
            "summary": "stored",
            "items": [
                {"fuel": "Benzin", "average_diff": 0.4},
                {"fuel": "Evil", "average_diff": 50},
            ],
            "remembered_at": "2026-10-09T10:00:00+03:00",
        }

        merged = merge_price_memory(current, previous)

        assert len(merged["items"]) == 1
        assert merged["items"][0]["fuel"] == "Benzin"
