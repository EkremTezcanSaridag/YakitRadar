"""Sprint 3: notification accuracy around large LPG moves, dedupe and quiet hours."""

import fiyat_servisi
from fiyat_servisi import (
    bildirim_mesaji_olustur,
    fiyat_bildirimleri_gonder,
    fiyat_degisimlerini_hesapla,
)
from notification_rules import price_change_dedupe_key

TOKEN = {
    "expo_push_token": "ExponentPushToken[test]",
    "quiet_hours": False,
    "city_alerts": True,
    "daily_alerts": True,
    "tracked_cities": [],
    "tracked_fuels": [],
}


def _lpg_change(diff=9.5):
    return {
        "city": "İstanbul",
        "fuel": "LPG",
        "field": "lpg",
        "old_price": 41.68,
        "new_price": 51.18,
        "diff": diff,
        "direction": "increase",
    }


class TestLargeChangeNotification:
    def test_lpg_change_kept_while_benzin_dropped(self, capsys):
        onceki = {
            "İstanbul": {"benzin_95": "78,00", "motorin": "96,00", "lpg": "41,68"},
        }
        yeni = {
            "İstanbul": {"benzin_95": "87,55", "motorin": "96,00", "lpg": "51,18"},
        }

        degisimler = fiyat_degisimlerini_hesapla(onceki, yeni)

        assert [item["fuel"] for item in degisimler] == ["LPG"]
        assert degisimler[0]["diff"] == 9.5

        output = capsys.readouterr().out
        assert "::warning::" in output
        assert "Benzin" in output
        assert "limit 8.00 TL" in output
        assert "1 fiyat degisimi olagan disi" in output

    def test_lpg_message_uses_wider_limit(self):
        message = bildirim_mesaji_olustur(TOKEN, _lpg_change())

        assert "LPG" in message["title"]
        assert "9.50 TL" in message["body"]
        assert message["data"]["type"] == "fuel_change"

    def test_lpg_limit_can_be_tuned_by_env(self, monkeypatch, capsys):
        monkeypatch.setattr(fiyat_servisi, "MAX_REASONABLE_LPG_CHANGE", 5.0)
        onceki = {"İstanbul": {"lpg": "41,68"}}
        yeni = {"İstanbul": {"lpg": "51,18"}}

        degisimler = fiyat_degisimlerini_hesapla(onceki, yeni)

        assert degisimler == []
        assert "limit 5.00 TL" in capsys.readouterr().out


class _Pipeline:
    """Wire fiyat_bildirimleri_gonder against in-memory fakes."""

    def __init__(self, monkeypatch):
        self.saved = []
        self.sent = []
        self.marked = []
        self.logs = []
        self.pending = []
        self.send_error = None

        monkeypatch.setattr(fiyat_servisi, "disable_stale_tokens", lambda *a, **k: 0)
        monkeypatch.setattr(fiyat_servisi, "bugun_signal_tarihi", lambda: "2026-11-13")
        monkeypatch.setattr(
            fiyat_servisi,
            "pending_fiyat_degisimleri_kaydet",
            lambda changes: self.saved.extend(changes),
        )
        monkeypatch.setattr(
            fiyat_servisi,
            "bekleyen_fiyat_degisimlerini_oku",
            lambda: list(self.pending),
        )

        def mark_sent(keys):
            self.marked.extend(keys)
            self.pending = [row for row in self.pending if row["dedupe_key"] not in keys]

        monkeypatch.setattr(fiyat_servisi, "bekleyen_fiyat_degisimlerini_gonderildi_isaretle", mark_sent)
        monkeypatch.setattr(fiyat_servisi, "push_tokenlarini_oku", lambda: [dict(TOKEN)])
        monkeypatch.setattr(fiyat_servisi, "sessiz_saatte_mi", lambda token: False)

        def fake_send(messages):
            if self.send_error:
                raise self.send_error
            self.sent.extend(messages)
            return len(messages), [{"status": "ok", "id": "ticket-1"} for _ in messages]

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

    def set_quiet(self, monkeypatch, quiet):
        monkeypatch.setattr(fiyat_servisi, "istanbul_quiet_hours_active", lambda now: quiet)


class TestQuietHoursQueue:
    def test_quiet_hours_queues_without_sending(self, monkeypatch):
        pipeline = _Pipeline(monkeypatch)
        pipeline.set_quiet(monkeypatch, True)

        fiyat_bildirimleri_gonder([_lpg_change()])

        assert len(pipeline.saved) == 1
        assert pipeline.sent == []
        assert pipeline.marked == []
        assert pipeline.logs[-1]["reason"] == "no_changes"

    def test_morning_flush_sends_pending_once_and_marks_it(self, monkeypatch):
        pipeline = _Pipeline(monkeypatch)
        pipeline.set_quiet(monkeypatch, True)
        fiyat_bildirimleri_gonder([_lpg_change()])
        saved_change = pipeline.saved[0]
        key = price_change_dedupe_key(saved_change, "2026-11-13")
        pipeline.pending = [
            {"dedupe_key": key, "change_payload": saved_change, "detected_at": "2026-11-13T02:30:00+03:00"}
        ]

        pipeline.set_quiet(monkeypatch, False)
        fiyat_bildirimleri_gonder([])

        assert len(pipeline.sent) == 1
        assert "LPG" in pipeline.sent[0]["title"]
        assert pipeline.marked == [key]
        assert pipeline.logs[-1]["status"] == "sent"
        assert pipeline.logs[-1]["reason"] == "pending_quiet_hours_flush"

        # A second run must not resend the already-flushed change.
        fiyat_bildirimleri_gonder([])
        assert len(pipeline.sent) == 1
        assert pipeline.logs[-1]["reason"] == "no_changes"

    def test_same_change_in_queue_and_fresh_scrape_sends_once(self, monkeypatch):
        pipeline = _Pipeline(monkeypatch)
        pipeline.set_quiet(monkeypatch, False)
        change = _lpg_change()
        key = price_change_dedupe_key(change, "2026-11-13")
        pipeline.pending = [
            {"dedupe_key": key, "change_payload": change, "detected_at": "2026-11-13T09:00:00+03:00"}
        ]

        fiyat_bildirimleri_gonder([dict(change)])

        assert len(pipeline.sent) == 1
        assert pipeline.marked == [key]

    def test_failed_send_keeps_queue_for_retry(self, monkeypatch):
        pipeline = _Pipeline(monkeypatch)
        pipeline.set_quiet(monkeypatch, False)
        change = _lpg_change()
        key = price_change_dedupe_key(change, "2026-11-13")
        pipeline.pending = [
            {"dedupe_key": key, "change_payload": change, "detected_at": "2026-11-13T09:00:00+03:00"}
        ]
        pipeline.send_error = RuntimeError("expo down")

        fiyat_bildirimleri_gonder([])

        assert pipeline.marked == []
        assert len(pipeline.pending) == 1
        assert pipeline.logs[-1]["status"] == "error"
        assert pipeline.logs[-1]["reason"] == "expo_api_error"
