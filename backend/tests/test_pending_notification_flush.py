"""Pending queue flush when scraper is skipped must still run after quiet hours."""

import notification_pending_flush as flush_module


def test_main_skips_during_quiet_hours(monkeypatch):
    monkeypatch.setattr(flush_module, "pending_queue_flush_allowed", lambda _now: False)
    monkeypatch.setattr(flush_module, "disable_stale_tokens", lambda *args, **kwargs: 0)
    monkeypatch.setattr(
        flush_module,
        "fiyat_bildirimleri_gonder",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not flush")),
    )

    assert flush_module.main() == 0


def test_main_flushes_after_quiet_hours(monkeypatch):
    calls = []

    monkeypatch.setattr(flush_module, "pending_queue_flush_allowed", lambda _now: True)
    monkeypatch.setattr(flush_module, "disable_stale_tokens", lambda *args, **kwargs: 0)
    monkeypatch.setattr(
        flush_module,
        "fiyat_bildirimleri_gonder",
        lambda *args, **kwargs: calls.append(args),
    )

    assert flush_module.main() == 0
    assert calls == [([], None)]
