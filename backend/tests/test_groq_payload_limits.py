"""Tests for Groq request payload limiting and 413 retry."""

import json
from unittest.mock import MagicMock

import pytest
import requests

from groq_payload_limits import (
    GROQ_MAX_NEWS_ITEMS,
    GROQ_MAX_TOTAL_PAYLOAD_CHARS,
    limit_groq_analysis_payload,
    trim_text,
)
from market_signals import call_groq_analysis


def _news_item(index: int, body_size: int) -> dict:
    return {
        "title": f"Haber {index}",
        "description": "x" * body_size,
        "article_text": "y" * body_size,
    }


class TestGroqPayloadLimits:
    def test_trims_long_news_and_caps_total_chars(self):
        payload = {
            "news": [_news_item(index, 5000) for index in range(30)],
            "news_analysis": {"direction": "neutral", "score": 0, "summary": "ok", "items": ["drop"]},
        }

        limited, stats = limit_groq_analysis_payload(payload)

        assert stats["news_items"] <= GROQ_MAX_NEWS_ITEMS
        assert stats["payload_chars"] <= GROQ_MAX_TOTAL_PAYLOAD_CHARS
        assert len(limited["news"][0]["description"]) < 5000
        assert "items" not in limited["news_analysis"]

    def test_normal_payload_unchanged_shape(self):
        payload = {
            "news": [{"title": "Kisa haber", "description": "Ozet"}],
            "pump_averages_tl_per_l": {"Benzin": 45.0},
        }

        limited, stats = limit_groq_analysis_payload(payload)

        assert limited["news"][0]["title"] == "Kisa haber"
        assert stats["news_items"] == 1
        assert trim_text("abc", 10) == "abc"


def _groq_success_response() -> MagicMock:
    body = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "direction": "neutral",
                            "timing": "Gündemde değişim yok",
                            "confidence": "low",
                            "summary": "Değişiklik beklenmiyor.",
                            "key_reason": "",
                            "signals": [
                                {
                                    "fuel": "Benzin",
                                    "direction": "neutral",
                                    "expected_amount_tl": None,
                                    "reason": "",
                                },
                                {
                                    "fuel": "Motorin",
                                    "direction": "neutral",
                                    "expected_amount_tl": None,
                                    "reason": "",
                                },
                                {
                                    "fuel": "LPG",
                                    "direction": "neutral",
                                    "expected_amount_tl": None,
                                    "reason": "",
                                },
                            ],
                        }
                    )
                }
            }
        ]
    }
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = body
    response.raise_for_status.return_value = None
    return response


def _http_413_error() -> requests.HTTPError:
    response = MagicMock()
    response.status_code = 413
    error = requests.HTTPError("413 Client Error: Payload Too Large")
    error.response = response
    return error


class TestGroq413Retry:
    def test_retries_once_after_413(self, monkeypatch):
        calls = {"count": 0}

        def fake_post(*_args, **_kwargs):
            calls["count"] += 1
            if calls["count"] == 1:
                raise _http_413_error()
            return _groq_success_response()

        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        monkeypatch.setattr("market_signals.requests.post", fake_post)

        result = call_groq_analysis({"news": [{"title": "a", "description": "b"}]})

        assert result is not None
        assert calls["count"] == 2
        assert result["model"].startswith("groq:")

    def test_second_413_returns_none_without_raising(self, monkeypatch):
        def fake_post(*_args, **_kwargs):
            raise _http_413_error()

        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        monkeypatch.setattr("market_signals.requests.post", fake_post)

        result = call_groq_analysis({"news": [{"title": "a"}]})

        assert result is None
