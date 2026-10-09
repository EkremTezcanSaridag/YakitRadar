"""Tests for http_client.make_request_with_retry (mocked HTTP)."""
from unittest.mock import MagicMock, patch

import pytest
import requests

from http_client import make_request_with_retry


@pytest.fixture(autouse=True)
def fast_retry_settings(monkeypatch):
    monkeypatch.setenv("SCRAPER_RATE_LIMIT_DELAY", "0")
    monkeypatch.setenv("SCRAPER_MAX_RETRIES", "3")
    monkeypatch.setenv("SCRAPER_RETRY_BASE_DELAY", "0.01")

    import http_client

    monkeypatch.setattr(http_client, "SCRAPER_RATE_LIMIT_DELAY", 0.0)
    monkeypatch.setattr(http_client, "SCRAPER_MAX_RETRIES", 3)
    monkeypatch.setattr(http_client, "SCRAPER_RETRY_BASE_DELAY", 0.01)


class TestMakeRequestWithRetry:
    @patch("http_client.time.sleep")
    @patch("http_client.requests.get")
    def test_success_first_attempt(self, mock_get, mock_sleep):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = make_request_with_retry("https://example.com/test")

        assert result is mock_response
        mock_get.assert_called_once()
        mock_sleep.assert_not_called()

    @patch("http_client.time.sleep")
    @patch("http_client.requests.get")
    def test_retries_after_timeout_then_succeeds(self, mock_get, mock_sleep):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_get.side_effect = [
            requests.exceptions.Timeout("timed out"),
            mock_response,
        ]

        result = make_request_with_retry("https://example.com/retry")

        assert result is mock_response
        assert mock_get.call_count == 2
        assert mock_sleep.call_count >= 1

    @patch("http_client.time.sleep")
    @patch("http_client.requests.get")
    def test_client_error_not_retried(self, mock_get, mock_sleep):
        mock_response = MagicMock()
        mock_response.status_code = 404
        error = requests.exceptions.HTTPError(response=mock_response)
        mock_get.return_value = mock_response
        mock_response.raise_for_status.side_effect = error

        with pytest.raises(requests.exceptions.HTTPError):
            make_request_with_retry("https://example.com/missing")

        mock_get.assert_called_once()
        mock_sleep.assert_not_called()

    @patch("http_client.time.sleep")
    @patch("http_client.requests.get")
    def test_rate_limit_retried(self, mock_get, mock_sleep):
        mock_429 = MagicMock()
        mock_429.status_code = 429
        error_429 = requests.exceptions.HTTPError(response=mock_429)
        mock_429.raise_for_status.side_effect = error_429

        mock_ok = MagicMock()
        mock_ok.raise_for_status = MagicMock()

        mock_get.side_effect = [mock_429, mock_ok]

        result = make_request_with_retry("https://example.com/limit")

        assert result is mock_ok
        assert mock_get.call_count == 2

    @patch("http_client.time.sleep")
    @patch("http_client.requests.get")
    def test_exhausted_retries_raises_runtime_error(self, mock_get, mock_sleep):
        mock_get.side_effect = requests.exceptions.Timeout("always slow")

        with pytest.raises(RuntimeError, match="Failed to fetch"):
            make_request_with_retry("https://example.com/fail")

        assert mock_get.call_count == 3

    @patch("http_client.requests.get")
    def test_custom_headers_and_timeout(self, mock_get):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        headers = {"User-Agent": "Mozilla/5.0"}
        make_request_with_retry("https://example.com/custom", headers=headers, timeout=99)

        mock_get.assert_called_once_with(
            "https://example.com/custom",
            headers=headers,
            timeout=99,
        )
