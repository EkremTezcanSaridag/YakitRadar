"""Tests for scheduled workflow freshness gate."""

from datetime import datetime, timedelta, timezone

from schedule_freshness import (
    SCHEDULE_FRESHNESS_MAX_AGE_MINUTES,
    parse_guncelleme_istanbul,
    should_skip_scheduled_scrape,
)


class TestParseGuncelleme:
    def test_parses_istanbul_timestamp(self):
        parsed = parse_guncelleme_istanbul("2026-10-19 07:51")
        assert parsed is not None
        assert parsed.hour == 7
        assert parsed.minute == 51


class TestShouldSkipScheduledScrape:
    def test_skips_when_recent(self):
        now = datetime(2026, 10, 19, 5, 30, tzinfo=timezone.utc)
        latest = datetime(2026, 10, 19, 8, 10, tzinfo=timezone(timedelta(hours=3)))

        assert should_skip_scheduled_scrape(latest, now=now, max_age_minutes=45)

    def test_runs_when_stale(self):
        now = datetime(2026, 10, 19, 10, 0, tzinfo=timezone.utc)
        latest = datetime(2026, 10, 19, 7, 51, tzinfo=timezone(timedelta(hours=3)))

        assert not should_skip_scheduled_scrape(
            latest,
            now=now,
            max_age_minutes=SCHEDULE_FRESHNESS_MAX_AGE_MINUTES,
        )
