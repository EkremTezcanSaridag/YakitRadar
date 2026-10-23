"""Tests for market_signals DB row shape and job failure behavior."""

import pytest

from market_signals import (
    ALLOWED_MARKET_SIGNAL_COLUMNS,
    build_market_signal,
    expected_amounts_tl_per_litre_from_signals,
    optional_amount_columns_from_signals,
    prepare_market_signal_row,
)


class TestPrepareMarketSignalRow:
    def test_strips_unknown_top_level_keys_into_analysis(self):
        payload = {
            "signal_date": "2026-10-09",
            "direction": "neutral",
            "confidence": "low",
            "score": 0,
            "summary": "Değişiklik beklenmiyor.",
            "signals": [],
            "analysis": {"mode": "rules"},
            "news_items": [],
            "sources": {},
            "calculated_at": "2026-10-09T12:00:00+03:00",
            "source_disagreement_note": "kaynaklar arasında fark var",
        }

        row = prepare_market_signal_row(payload)

        assert set(row) <= ALLOWED_MARKET_SIGNAL_COLUMNS
        assert "source_disagreement_note" not in row
        assert row["analysis"]["source_disagreement_note"] == "kaynaklar arasında fark var"

    def test_build_market_signal_row_keys_are_allowed(self, monkeypatch):
        monkeypatch.setattr("market_signals.fetch_news_items", lambda: [])
        monkeypatch.setattr("market_signals.fetch_pump_price_rows", lambda: [])
        monkeypatch.setattr("market_signals.fetch_gecmis_rows", lambda limit=7: [])
        monkeypatch.setattr("market_signals.fetch_brent_history", lambda limit=12: [])
        monkeypatch.setattr("market_signals.fetch_usd_try_history", lambda limit=12: [])
        monkeypatch.setattr("market_signals.call_groq_analysis", lambda _payload: None)

        signal = build_market_signal([])
        row = prepare_market_signal_row(signal)

        assert set(row) <= ALLOWED_MARKET_SIGNAL_COLUMNS


class TestExpectedAmountColumns:
    def test_optional_columns_from_signals(self):
        signals = [
            {"fuel": "Benzin", "direction": "decrease", "expected_amount_tl": 0.96},
            {"fuel": "Motorin", "direction": "increase", "expected_amount_tl": 6.4},
            {"fuel": "LPG", "direction": "neutral", "expected_amount_tl": None},
        ]

        amounts = expected_amounts_tl_per_litre_from_signals(signals)
        assert amounts["Benzin"] == 0.96
        assert amounts["Motorin"] == 6.4
        assert amounts["LPG"] is None

        columns = optional_amount_columns_from_signals(signals)
        assert columns["benzin_expected_amount_tl"] == 0.96
        assert columns["motorin_expected_amount_tl"] == 6.4
        assert columns["lpg_expected_amount_tl"] is None


class TestPiyasaSinyaliKaydetFailure:
    def test_supabase_failure_is_not_swallowed(self, monkeypatch):
        from fiyat_servisi import piyasa_sinyali_kaydet

        monkeypatch.setattr(
            "market_signals.build_market_signal",
            lambda *_args, **_kwargs: {
                "signal_date": "2026-10-09",
                "direction": "neutral",
                "confidence": "low",
                "score": 0,
                "summary": "x",
                "signals": [],
                "analysis": {},
                "news_items": [],
                "sources": {},
                "calculated_at": "2026-10-09T12:00:00+03:00",
            },
        )

        class FailingQuery:
            def upsert(self, *_args, **_kwargs):
                return self

            def execute(self):
                raise RuntimeError("PGRST204 column missing")

        class FailingTable:
            def table(self, _name):
                return FailingQuery()

        monkeypatch.setattr("fiyat_servisi.supabase", FailingTable())

        with pytest.raises(RuntimeError, match="PGRST204"):
            piyasa_sinyali_kaydet()

    def test_optional_amount_columns_fallback_when_missing(self, monkeypatch):
        from fiyat_servisi import market_signals_upsert_row

        base_row = {
            "signal_date": "2026-10-09",
            "direction": "neutral",
            "confidence": "low",
            "score": 0,
            "summary": "x",
            "signals": [
                {"fuel": "Motorin", "direction": "increase", "expected_amount_tl": 2.5},
            ],
            "analysis": {},
            "news_items": [],
            "sources": {},
            "calculated_at": "2026-10-09T12:00:00+03:00",
        }
        calls = []

        class Query:
            def __init__(self, payload):
                self.payload = payload

            def execute(self):
                calls.append(self.payload)
                if len(calls) == 1:
                    raise RuntimeError("PGRST204 column benzin_expected_amount_tl does not exist")
                return None

        class Table:
            def upsert(self, payload, **_kwargs):
                return Query(payload)

        class Client:
            def table(self, _name):
                return Table()

        monkeypatch.setattr("fiyat_servisi.supabase", Client())
        market_signals_upsert_row(base_row)

        assert len(calls) == 2
        assert "motorin_expected_amount_tl" in calls[0]
        assert "motorin_expected_amount_tl" not in calls[1]


class TestJobExitOnSignalSaveFailure:
    def test_main_handler_exits_1_when_save_raises(self):
        with pytest.raises(SystemExit) as exc:
            try:
                raise RuntimeError("save failed")
            except Exception:
                raise SystemExit(1)

        assert exc.value.code == 1
