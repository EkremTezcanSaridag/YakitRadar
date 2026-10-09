"""Tests for publisher RSS parsing and article enrichment."""

from datetime import datetime, timedelta, timezone

from groq_market_analysis import extract_price_amounts_from_fields
from market_signals import normalize_text
from news_article_sources import (
    PUBLISHER_RSS_FEEDS,
    ArticleFetchBudget,
    enrich_items_with_article_bodies,
    extract_cdata_description,
    fetch_article_body_with_status,
    parse_publisher_rss_items,
    should_fetch_publisher_article,
)

SAMPLE_RSS = (
    b'<?xml version="1.0" encoding="UTF-8"?>'
    b"<rss version=\"2.0\"><channel><item>"
    b"<title><![CDATA[Motorine 6,40 TL zam, benzine 96 kurus indirim]]></title>"
    b"<link>https://example.test/haber/1</link>"
    b"<description><![CDATA[bu gece yarisindan itibaren motorine 6,40 TL zam.]]></description>"
    b"<pubDate>Thu, 09 Oct 2026 18:00:00 +0300</pubDate>"
    b"</item></channel></rss>"
)


def parse_date_fn(value):
    if not value:
        return None

    return datetime(2026, 10, 9, 18, 0, tzinfo=timezone(timedelta(hours=3)))


class TestPublisherRssConstant:
    def test_only_working_feeds_listed(self):
        names = {entry["name"] for entry in PUBLISHER_RSS_FEEDS}

        assert names == {"Ekonomim Ekonomi", "Haberturk Ekonomi"}

    def test_removed_unreliable_sources(self):
        urls = " ".join(entry["url"] for entry in PUBLISHER_RSS_FEEDS)

        assert "sozcu" not in urls
        assert "t24.com" not in urls


class TestParsePublisherRss:
    def test_lead_description_extracts_amounts(self):
        items = parse_publisher_rss_items(SAMPLE_RSS, "Test Feed", parse_date_fn=parse_date_fn)
        assert len(items) == 1
        lead = items[0]["description"]
        amounts = extract_price_amounts_from_fields(
            items[0]["title"],
            lead,
            lead,
            normalize_text,
        )
        fuels = {(entry["fuel"], entry["direction"]) for entry in amounts}
        assert ("Motorin", "increase") in fuels

    def test_cdata_description_strips_html(self):
        raw = "<![CDATA[<p>motorine <strong>1,20 TL</strong> zam</p>]]>"
        text = extract_cdata_description(raw)
        assert "motorine" in text
        assert "<p>" not in text


class TestPublisherArticleFallback:
    def test_should_fetch_when_publisher_description_has_no_amounts(self):
        item = {
            "source": "Ekonomim Ekonomi",
            "feed_origin": "publisher",
            "description": "Genel ekonomi gundemi.",
            "url": "https://example.test/haber/2",
        }

        assert should_fetch_publisher_article(item, normalize_text) is True

    def test_skips_when_description_already_has_amounts(self):
        item = {
            "source": "Ekonomim Ekonomi",
            "feed_origin": "publisher",
            "description": "motorine 2 TL zam",
            "url": "https://example.test/haber/3",
        }

        assert should_fetch_publisher_article(item, normalize_text) is False

    def test_enrich_logs_and_attaches_article_text(self, monkeypatch):
        calls = []

        def fake_fetch(url, budget=None):
            calls.append(url)
            return (
                "Sektör kaynaklarına göre motorine 6,40 TL zam, benzine 96 kuruş indirim bekleniyor.",
                200,
                None,
            )

        monkeypatch.setattr("news_article_sources.fetch_article_body_with_status", fake_fetch)

        items = [
            {
                "title": "Akaryakit",
                "source": "Haberturk Ekonomi",
                "feed_origin": "publisher",
                "description": "Gundem.",
                "url": "https://example.test/haber/4",
            }
        ]

        enriched = enrich_items_with_article_bodies(items, normalize_text_fn=normalize_text, max_items=5)
        assert calls == ["https://example.test/haber/4"]
        assert "article_text" in enriched[0]
        assert extract_price_amounts_from_fields(
            enriched[0]["title"],
            enriched[0]["description"],
            enriched[0]["description"],
            normalize_text,
            enriched[0]["article_text"],
        )


class TestArticleFetchBudget:
    def test_budget_limits_requests(self, monkeypatch):
        budget = ArticleFetchBudget(max_requests=2, max_seconds=20)

        def fake_get(*_args, **_kwargs):
            class Resp:
                status_code = 200
                url = "https://example.test/a"
                text = "<p>motorine 1 TL zam yapildi uzun paragraf metni burada.</p>"

            return Resp()

        monkeypatch.setattr("news_article_sources.requests.get", fake_get)

        for _ in range(2):
            body, status, _err = fetch_article_body_with_status("https://example.test/a", budget=budget)
            assert body
            assert status == 200

        body, status, err = fetch_article_body_with_status("https://example.test/a", budget=budget)
        assert body is None
        assert err == "budget_exhausted"
