"""Tests for publisher RSS parsing and article enrichment."""

from datetime import datetime, timedelta, timezone

from groq_market_analysis import extract_price_amounts_from_fields
from market_signals import normalize_text
from news_article_sources import (
    PUBLISHER_RSS_FEEDS,
    enrich_items_with_article_bodies,
    extract_cdata_description,
    parse_publisher_rss_items,
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
    def test_feed_urls_in_single_tuple(self):
        urls = [entry["url"] for entry in PUBLISHER_RSS_FEEDS]
        assert "https://www.ekonomim.com/rss/ekonomi.xml" in urls
        assert "https://www.haberturk.com/rss/ekonomi.xml" in urls
        assert len(urls) == len(set(urls))


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
        assert ("Benzin", "decrease") in fuels

    def test_cdata_description_strips_html(self):
        raw = "<![CDATA[<p>motorine <strong>1,20 TL</strong> zam</p>]]>"
        text = extract_cdata_description(raw)
        assert "motorine" in text
        assert "<p>" not in text


class TestArticleBodyEnrichment:
    def test_skips_fetch_when_amounts_present(self, monkeypatch):
        calls = []

        def fake_fetch(url):
            calls.append(url)
            return "should not be used"

        monkeypatch.setattr("news_article_sources.fetch_article_body_text", fake_fetch)

        items = [{"title": "motorine 2 TL zam", "url": "https://example.test/a"}]

        def has_amounts(item):
            return bool(
                extract_price_amounts_from_fields(
                    item.get("title"),
                    None,
                    None,
                    normalize_text,
                )
            )

        enriched = enrich_items_with_article_bodies(items, has_amounts_fn=has_amounts)
        assert calls == []
        assert "article_text" not in enriched[0]

    def test_fetches_when_missing_amounts(self, monkeypatch):
        monkeypatch.setattr(
            "news_article_sources.fetch_article_body_text",
            lambda url: "Detay paragraf: motorine 3,50 TL zam bekleniyor.",
        )

        items = [{"title": "Akaryakit gundemi", "url": "https://example.test/b"}]

        def has_amounts(_item):
            return False

        enriched = enrich_items_with_article_bodies(items, has_amounts_fn=has_amounts, max_items=5)
        assert "article_text" in enriched[0]
