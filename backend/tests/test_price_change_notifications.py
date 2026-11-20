"""Sprint 8: "zam/indirim gerçekleşti" bildirimleri.

Gerçek fiyat değişimi bildirimi, kullanıcının takip ettiği illeri ve yakıtları
dikkate alır, tek çalıştırmada eşleşen tüm değişimleri tek push'ta özetler ve
`price_change_alerts` tercihine saygı duyar.
"""

import fiyat_servisi
from fiyat_servisi import fiyat_bildirimleri_gonder, fiyat_degisim_mesaji_olustur
from notification_rules import (
    price_change_alerts_enabled,
    select_price_changes_for_token,
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


def _change(city="İstanbul", fuel="Benzin", old=44.5, new=43.9, source=None):
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


class TestSelection:
    def test_city_and_fuel_filters_are_case_insensitive(self):
        token = {
            "tracked_cities": ["istanbul"],
            "tracked_fuels": ["benzin"],
        }

        selected = select_price_changes_for_token(
            token,
            [_change(), _change(fuel="Motorin"), _change(city="Ankara")],
        )

        assert len(selected) == 1
        assert selected[0]["city"] == "İstanbul"
        assert selected[0]["fuel"] == "Benzin"

    def test_missing_preference_defaults_to_enabled(self):
        assert price_change_alerts_enabled({}) is True
        assert price_change_alerts_enabled({"price_change_alerts": None}) is True
        assert price_change_alerts_enabled({"price_change_alerts": False}) is False

    def test_opt_out_suppresses_every_change(self):
        token = dict(TOKEN, price_change_alerts=False)

        assert select_price_changes_for_token(token, [_change()]) == []

    def test_every_matching_change_is_selected_up_to_the_limit(self):
        changes = [_change(old=44.5, new=43.9), _change(old=44.5, new=45.1), _change(old=44.5, new=46.0)]

        selected = select_price_changes_for_token(dict(TOKEN, tracked_fuels=[]), changes)

        assert len(selected) == 3

    def test_price_memory_signal_ignores_city_filter(self):
        memory_change = _change(city="Ankara", source="price_memory")

        selected = select_price_changes_for_token(TOKEN, [memory_change])

        assert selected == [memory_change]

    def test_expected_change_rows_are_not_duplicated_here(self):
        expected = _change(city="Turkiye geneli", source="expected_change")

        assert select_price_changes_for_token(TOKEN, [expected]) == []


class TestMessage:
    def test_single_change_mentions_zam_or_indirim_and_prices(self):
        message = fiyat_degisim_mesaji_olustur(TOKEN, [_change(old=44.5, new=43.9)])

        assert "indirimi" in message["title"]
        assert "44.50" in message["body"] and "43.90" in message["body"]
        assert "-0.60 TL" in message["body"]
        assert message["data"]["count"] == 1

    def test_increase_is_reported_as_zam(self):
        message = fiyat_degisim_mesaji_olustur(TOKEN, [_change(old=44.5, new=45.1)])

        assert "zammı" in message["title"]
        assert "+0.60 TL" in message["body"]

    def test_multiple_changes_are_sent_as_one_summary(self):
        changes = [
            _change(old=44.5, new=45.1),
            _change(fuel="Motorin", old=52.0, new=51.4),
            _change(fuel="LPG", old=28.0, new=28.4),
        ]

        message = fiyat_degisim_mesaji_olustur(TOKEN, changes)

        assert message["title"] == "3 fiyat değişikliği · 2 zam, 1 indirim"
        assert message["data"]["count"] == 3
        assert len(message["data"]["changes"]) == 3
        assert message["body"].count("\n") == 2
        for fuel in ("Benzin", "Motorin", "LPG"):
            assert fuel in message["body"]


class _Pipeline:
    def __init__(self, monkeypatch, tokens):
        self.sent = []
        self.logs = []
        self.tokens = tokens

        monkeypatch.setattr(fiyat_servisi, "disable_stale_tokens", lambda *a, **k: 0)
        monkeypatch.setattr(fiyat_servisi, "bugun_signal_tarihi", lambda: "2026-11-20")
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
    def test_matching_device_gets_one_aggregated_push(self, monkeypatch):
        pipeline = _Pipeline(monkeypatch, [TOKEN])

        fiyat_bildirimleri_gonder([
            _change(old=44.5, new=45.1),
            _change(fuel="Motorin", old=52.0, new=51.4),
        ])

        assert len(pipeline.sent) == 1
        assert pipeline.sent[0]["data"]["count"] == 2
        assert pipeline.logs[-1]["status"] == "sent"

    def test_device_tracking_another_city_is_skipped(self, monkeypatch):
        pipeline = _Pipeline(monkeypatch, [dict(TOKEN, tracked_cities=["Ankara"])])

        fiyat_bildirimleri_gonder([_change(city="İstanbul")])

        assert pipeline.sent == []
        assert pipeline.logs[-1]["reason"] == "no_matching_devices"
        assert pipeline.logs[-1]["skipped_no_match_count"] == 1

    def test_opt_out_device_is_skipped(self, monkeypatch):
        pipeline = _Pipeline(monkeypatch, [dict(TOKEN, price_change_alerts=False)])

        fiyat_bildirimleri_gonder([_change()])

        assert pipeline.sent == []
        assert pipeline.logs[-1]["reason"] == "no_matching_devices"
