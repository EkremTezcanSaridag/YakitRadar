"""TCMB USD/TRY fetch falls back on 404 to previous business days."""
from datetime import date
from unittest.mock import MagicMock

import pytest
import requests

from market_signals import (
    TCMB_NOT_FOUND_FALLBACK_MAX_STEPS,
    fetch_usd_try_for_date,
    previous_business_day,
    tcmb_url_for_date,
)

USD_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date>
  <Currency CurrencyCode="USD">
    <ForexSelling>36.10</ForexSelling>
  </Currency>
</Tarih_Date>"""


def _http_error(status_code):
    response = MagicMock()
    response.status_code = status_code
    error = requests.exceptions.HTTPError(response=response)
    return error


def _ok_response(content=USD_XML):
    response = MagicMock()
    response.status_code = 200
    response.content = content
    return response


class TestPreviousBusinessDay:
    def test_skips_weekend_from_monday(self):
        assert previous_business_day(date(2026, 10, 19)) == date(2026, 10, 16)

    def test_friday_from_saturday(self):
        assert previous_business_day(date(2026, 10, 17)) == date(2026, 10, 16)


class TestFetchUsdTryWeekendFallback:
    def test_saturday_404_uses_friday_rate(self, monkeypatch):
        saturday = date(2026, 10, 17)
        friday = date(2026, 10, 16)
        urls = []

        def fake_request(url):
            urls.append(url)
            if url == tcmb_url_for_date(saturday):
                raise _http_error(404)
            if url == tcmb_url_for_date(friday):
                return _ok_response()
            raise AssertionError(f"unexpected url {url}")

        monkeypatch.setattr("market_signals.make_request_with_retry", fake_request)

        record = fetch_usd_try_for_date(saturday)

        assert record["date"] == friday
        assert record["rate"] == 36.10
        assert record["source_url"] == tcmb_url_for_date(friday)
        assert urls == [tcmb_url_for_date(saturday), tcmb_url_for_date(friday)]

    def test_stops_after_max_fallback_steps(self, monkeypatch):
        start = date(2026, 10, 19)
        call_count = 0

        def fake_request(_url):
            nonlocal call_count
            call_count += 1
            raise _http_error(404)

        monkeypatch.setattr("market_signals.make_request_with_retry", fake_request)

        with pytest.raises(requests.exceptions.HTTPError):
            fetch_usd_try_for_date(start)

        assert call_count == TCMB_NOT_FOUND_FALLBACK_MAX_STEPS + 1

    def test_non_404_errors_do_not_fallback(self, monkeypatch):
        day = date(2026, 10, 16)
        calls = []

        def fake_request(url):
            calls.append(url)
            raise _http_error(500)

        monkeypatch.setattr("market_signals.make_request_with_retry", fake_request)

        with pytest.raises(requests.exceptions.HTTPError):
            fetch_usd_try_for_date(day)

        assert len(calls) == 1
