"""Beklenen zam/indirim gerçekleşti bildirimi.

Haber analizi bir zam/indirim beklentisi üretir; pompa fiyatı ertesi gün
değiştiğinde beklenti ile gerçekleşen değişim eşleştirilir ve tek push'ta
"Beklenen LPG indirimi gerçekleşti" mesajı gönderilir.
"""

import json
from types import SimpleNamespace

import fiyat_servisi
from expected_change_realized import (
    actual_change_by_fuel,
    find_realized_expectations,
    realized_by_fuel,
    realized_tolerance,
)
from fiyat_servisi import (
    bildirim_mesaji_olustur,
    fiyat_bildirimleri_gonder,
    fiyat_degisim_mesaji_olustur,
)

TOKEN = {
    "expo_push_token": "ExponentPushToken[test]",
    "quiet_hours": False,
    "city_alerts": True,
    "daily_alerts": True,
    "price_change_alerts": True,
    "tracked_cities": ["İstanbul"],
    "tracked_fuels": ["Benzin", "Motorin", "LPG"],
}


def _change(city="İstanbul", fuel="LPG", old=48.10, new=42.90, source=None):
    change = {
        "city": city,
        "fuel": fuel,
        "field": fuel.lower(),
        "old_price": old,
        "new_price": new,
        "diff": round(new - old, 2),
        "direction": "increase" if new > old else "decrease",
    }
    if source:
        change["source"] = source
    return change


def _expectation(fuel="LPG", amount=5.2, direction="decrease", signal_date="2026-11-24"):
    return {
        "fuel": fuel,
        "direction": direction,
        "expected_amount_tl": amount,
        "signal_date": signal_date,
    }


class TestActualChange:
    def test_median_is_used_across_cities(self):
        changes = [
            _change(city="İstanbul", old=48.10, new=42.90),
            _change(city="Ankara", old=48.20, new=43.00),
            _change(city="İzmir", old=48.15, new=43.30),
        ]

        actual = actual_change_by_fuel(changes)

        assert actual["lpg"]["actual_amount"] == 5.2
        assert actual["lpg"]["direction"] == "decrease"
        assert actual["lpg"]["city_count"] == 3

    def test_expected_and_memory_rows_are_ignored(self):
        changes = [
            _change(source="expected_change", old=48.10, new=42.90),
            _change(source="price_memory", old=48.10, new=42.90),
        ]

        assert actual_change_by_fuel(changes) == {}

    def test_zero_diff_is_ignored(self):
        assert actual_change_by_fuel([_change(old=48.10, new=48.10)]) == {}


class TestMatching:
    def test_matching_direction_and_amount_are_reported(self):
        matches = find_realized_expectations([_change(old=48.10, new=42.90)], [_expectation()])

        assert len(matches) == 1
        assert matches[0]["fuel_key"] == "lpg"
        assert matches[0]["expected_amount"] == 5.2
        assert matches[0]["actual_amount"] == 5.2
        assert matches[0]["direction"] == "decrease"

    def test_opposite_direction_is_not_a_match(self):
        matches = find_realized_expectations(
            [_change(old=42.90, new=48.10)],
            [_expectation(direction="decrease")],
        )

        assert matches == []

    def test_out_of_tolerance_is_not_a_match(self):
        matches = find_realized_expectations(
            [_change(old=48.10, new=45.60)],
            [_expectation(amount=5.2)],
        )

        assert matches == []

    def test_small_expectation_uses_absolute_tolerance(self):
        matches = find_realized_expectations(
            [_change(old=48.10, new=47.60)],
            [_expectation(amount=0.4)],
        )

        assert len(matches) == 1
        assert matches[0]["expected_amount"] == 0.4

    def test_newest_expectation_per_fuel_wins(self):
        expectations = [
            _expectation(amount=5.2, signal_date="2026-11-24"),
            _expectation(amount=2.0, signal_date="2026-11-20"),
        ]

        matches = find_realized_expectations([_change(old=48.10, new=42.90)], expectations)

        assert len(matches) == 1
        assert matches[0]["signal_date"] == "2026-11-24"

    def test_entries_without_amount_are_skipped(self):
        matches = find_realized_expectations(
            [_change(old=48.10, new=42.90)],
            [{"fuel": "LPG", "direction": "decrease", "expected_amount_tl": None}],
        )

        assert matches == []

    def test_realized_by_fuel_indexes_matches(self):
        matches = find_realized_expectations([_change(old=48.10, new=42.90)], [_expectation()])
        indexed = realized_by_fuel(matches)

        assert indexed["lpg"]["expected_amount"] == 5.2

    def test_tolerance_prefers_larger_of_absolute_and_ratio(self):
        assert abs(realized_tolerance(5.2) - 1.82) < 1e-9
        assert realized_tolerance(0.4) == 0.75


class TestMessage:
    def test_realized_single_change_mentions_expectation(self):
        match = find_realized_expectations([_change(old=48.10, new=42.90)], [_expectation()])[0]

        message = bildirim_mesaji_olustur(TOKEN, _change(old=48.10, new=42.90), match)

        assert message["title"] == "Beklenen LPG indirimi gerçekleşti"
        assert "48.10 → 42.90 TL" in message["body"]
        assert "Beklenen 5.20 TL" in message["body"]
        assert message["data"]["type"] == "expected_change_realized"
        assert message["data"]["expectedAmount"] == 5.2
        assert message["data"]["signalDate"] == "2026-11-24"

    def test_realized_increase_mentions_zam(self):
        match = find_realized_expectations(
            [_change(old=42.90, new=48.10)],
            [_expectation(direction="increase")],
        )[0]

        message = bildirim_mesaji_olustur(TOKEN, _change(old=42.90, new=48.10), match)

        assert message["title"] == "Beklenen LPG zammı gerçekleşti"

    def test_non_matching_realization_falls_back_to_plain_message(self):
        match = find_realized_expectations([_change(old=48.10, new=42.90)], [_expectation()])[0]

        message = bildirim_mesaji_olustur(TOKEN, _change(fuel="Motorin", old=52.0, new=51.4), match)

        assert "gerçekleşti" not in message["title"]
        assert message["data"]["type"] == "fuel_change"

    def test_summary_adds_realized_note_once_per_fuel(self):
        matches = find_realized_expectations(
            [
                _change(city="İstanbul", old=48.10, new=42.90),
                _change(city="Ankara", old=48.20, new=43.00),
            ],
            [_expectation()],
        )
        indexed = realized_by_fuel(matches)

        message = fiyat_degisim_mesaji_olustur(
            TOKEN,
            [
                _change(city="İstanbul", old=48.10, new=42.90),
                _change(city="Ankara", old=48.20, new=43.00),
            ],
            indexed,
        )

        assert message["body"].count("Beklenen LPG indirimi gerçekleşti") == 1
        assert message["data"]["realized"][0]["fuel"] == "lpg"


class _SignalQuery:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *args, **kwargs):
        return self

    def gte(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class TestSignalLookup:
    def test_recent_signals_are_flat_and_confidence_filtered(self, monkeypatch):
        rows = [
            {
                "signal_date": "2026-11-25",
                "confidence": "high",
                "signals": json.dumps(
                    [{"fuel": "LPG", "direction": "decrease", "expected_amount_tl": 5.2, "confidence": "low"}]
                ),
            },
            {
                "signal_date": "2026-11-24",
                "confidence": "high",
                "signals": [
                    {
                        "fuel": "Benzin",
                        "direction": "increase",
                        "expected_amount_tl": 1.5,
                    }
                ],
            },
        ]
        monkeypatch.setattr(
            fiyat_servisi,
            "supabase",
            SimpleNamespace(table=lambda name: _SignalQuery(rows)),
        )

        signals = fiyat_servisi.son_beklenen_sinyalleri_oku()

        assert len(signals) == 1
        assert signals[0]["fuel"] == "Benzin"
        assert signals[0]["signal_date"] == "2026-11-24"
        assert signals[0]["confidence"] == "high"

    def test_realization_lookup_uses_recent_signals(self, monkeypatch):
        monkeypatch.setattr(fiyat_servisi, "son_beklenen_sinyalleri_oku", lambda: [_expectation()])

        matches = fiyat_servisi.beklenen_degisim_gerceklesti_mi(
            [_change(old=48.10, new=42.90)]
        )

        assert len(matches) == 1
        assert matches[0]["expected_amount"] == 5.2


class _Pipeline:
    def __init__(self, monkeypatch, tokens):
        self.sent = []
        self.logs = []
        self.tokens = tokens

        monkeypatch.setattr(fiyat_servisi, "disable_stale_tokens", lambda *a, **k: 0)
        monkeypatch.setattr(fiyat_servisi, "bugun_signal_tarihi", lambda: "2026-11-25")
        monkeypatch.setattr(fiyat_servisi, "pending_fiyat_degisimleri_kaydet", lambda changes: None)
        monkeypatch.setattr(fiyat_servisi, "bekleyen_fiyat_degisimlerini_oku", lambda: [])
        monkeypatch.setattr(fiyat_servisi, "bekleyen_fiyat_degisimlerini_gonderildi_isaretle", lambda keys: None)
        monkeypatch.setattr(fiyat_servisi, "istanbul_quiet_hours_active", lambda now: False)
        monkeypatch.setattr(fiyat_servisi, "sessiz_saatte_mi", lambda token: False)
        monkeypatch.setattr(fiyat_servisi, "push_tokenlarini_oku", lambda: [dict(token) for token in self.tokens])

        def fake_send(messages):
            self.sent.extend(messages)
            return len(messages), [{"status": "ok", "id": f"ticket-{index}"} for index, _ in enumerate(messages)]

        monkeypatch.setattr(fiyat_servisi, "send_expo_messages", fake_send)
        monkeypatch.setattr(
            fiyat_servisi,
            "process_expo_push_delivery",
            lambda messages, responses: {"disabled_tokens": 0},
        )
        monkeypatch.setattr(
            fiyat_servisi,
            "bildirim_log_kaydet",
            lambda *args, **kwargs: self.logs.append({"args": args, **kwargs}),
        )


class TestPipeline:
    def test_realized_expectation_is_sent_in_the_single_push(self, monkeypatch):
        pipeline = _Pipeline(monkeypatch, [TOKEN])
        matches = find_realized_expectations([_change(old=48.10, new=42.90)], [_expectation()])

        fiyat_bildirimleri_gonder([_change(old=48.10, new=42.90)], gerceklesenler=matches)

        assert len(pipeline.sent) == 1
        assert pipeline.sent[0]["title"] == "Beklenen LPG indirimi gerçekleşti"
        assert pipeline.logs[-1]["details"]["realized_expectations"][0]["fuel"] == "lpg"

    def test_without_match_the_plain_change_message_is_kept(self, monkeypatch):
        pipeline = _Pipeline(monkeypatch, [TOKEN])

        fiyat_bildirimleri_gonder([_change(old=48.10, new=42.90)])

        assert "gerçekleşti" not in pipeline.sent[0]["title"]
        assert pipeline.logs[-1]["details"]["realized_expectations"] == []

    def test_expectation_push_is_skipped_when_change_already_realized(self, monkeypatch):
        sent = []
        monkeypatch.setattr(fiyat_servisi, "disable_stale_tokens", lambda *a, **k: 0)
        monkeypatch.setattr(fiyat_servisi, "istanbul_quiet_hours_active", lambda now: False)
        monkeypatch.setattr(
            fiyat_servisi,
            "filter_expected_change_signals",
            lambda row: [{"fuel": "LPG", "direction": "increase", "expected_amount_tl": 5.2}],
        )
        monkeypatch.setattr(fiyat_servisi, "push_tokenlarini_oku", lambda: [dict(TOKEN)])
        monkeypatch.setattr(fiyat_servisi, "beklenen_degisim_bugun_gonderildi_mi", lambda d, f: False)
        monkeypatch.setattr(fiyat_servisi, "bildirim_log_kaydet", lambda *a, **k: None)
        monkeypatch.setattr(fiyat_servisi, "send_expo_messages", lambda messages: (sent.extend(messages) or len(messages), []))

        fiyat_servisi.beklenen_degisim_bildirimleri_gonder(
            {"signal_date": "2026-11-25"},
            gerceklesen_yakitlar=["LPG"],
        )

        assert sent == []
