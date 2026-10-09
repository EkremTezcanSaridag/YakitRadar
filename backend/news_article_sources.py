"""Publisher RSS and optional article body fetch for news amount extraction."""

import os
import re
from html import unescape
from typing import Any
from urllib.parse import urlparse
from xml.etree import ElementTree

from http_client import make_request_with_retry

ARTICLE_FETCH_TIMEOUT = int(os.getenv("NEWS_ARTICLE_FETCH_TIMEOUT", "3"))
ARTICLE_FETCH_MAX_ITEMS = int(os.getenv("NEWS_ARTICLE_FETCH_MAX", "5"))
ARTICLE_MAX_PARAGRAPHS = 5

# Direct publisher feeds (primary path for lead paragraphs in <description>).
PUBLISHER_RSS_FEEDS = (
    {
        "name": "Ekonomim Ekonomi",
        "url": "https://www.ekonomim.com/rss/ekonomi.xml",
    },
    {
        "name": "Haberturk Ekonomi",
        "url": "https://www.haberturk.com/rss/ekonomi.xml",
    },
    {
        "name": "Sozcu Ekonomi",
        "url": "https://www.sozcu.com.tr/feeds-rss-category-sozcu-ekonomi",
    },
    {
        "name": "T24 Ekonomi",
        "url": "https://t24.com.tr/rss/haber/ekonomi",
    },
    {
        "name": "T24 Akaryakit",
        "url": "https://t24.com.tr/rss/haber/akaryakit",
    },
)

GOOGLE_NEWS_HOST_MARKERS = ("news.google.com",)


def is_google_news_url(url: str) -> bool:
    if not url:
        return False

    host = urlparse(url).netloc.lower()

    return any(marker in host for marker in GOOGLE_NEWS_HOST_MARKERS)


def extract_cdata_description(raw: str | None) -> str:
    if not raw:
        return ""

    text = raw.strip()

    if "<![CDATA[" in text:
        match = re.search(r"<!\[CDATA\[(.*?)\]\]>", text, flags=re.DOTALL | re.IGNORECASE)

        if match:
            text = match.group(1)

    return unescape(re.sub(r"<[^>]+>", " ", text))


def extract_paragraph_text_from_html(html: str) -> str:
    if not html:
        return ""

    without_scripts = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    paragraphs = re.findall(r"<p[^>]*>(.*?)</p>", without_scripts, flags=re.DOTALL | re.IGNORECASE)
    cleaned = []

    for paragraph in paragraphs[:ARTICLE_MAX_PARAGRAPHS]:
        text = unescape(re.sub(r"<[^>]+>", " ", paragraph))
        text = re.sub(r"\s+", " ", text).strip()

        if len(text) >= 40:
            cleaned.append(text)

    if cleaned:
        return "\n\n".join(cleaned)

    fallback = unescape(re.sub(r"<[^>]+>", " ", without_scripts))
    return re.sub(r"\s+", " ", fallback).strip()[:4000]


def fetch_article_body_text(url: str) -> str | None:
    if not url or is_google_news_url(url):
        return None

    try:
        response = make_request_with_retry(
            url,
            headers={
                "User-Agent": "YakitRadar/1.0",
                "Accept": "text/html,application/xhtml+xml",
            },
            timeout=ARTICLE_FETCH_TIMEOUT,
        )
    except Exception as error:
        print(f"Haber metni alinamadi ({url}): {error}")
        return None

    final_url = response.url or url

    if is_google_news_url(final_url):
        return None

    return extract_paragraph_text_from_html(response.text)


def enrich_items_with_article_bodies(
    items: list[dict[str, Any]],
    *,
    has_amounts_fn,
    max_items: int = ARTICLE_FETCH_MAX_ITEMS,
) -> list[dict[str, Any]]:
    enriched = []
    fetched = 0

    for item in items:
        copy = dict(item)

        if fetched < max_items and not has_amounts_fn(copy):
            body = fetch_article_body_text(copy.get("url") or "")

            if body:
                copy["article_text"] = body
                fetched += 1

        enriched.append(copy)

    return enriched


def parse_publisher_rss_items(
    xml_content: bytes,
    feed_name: str,
    *,
    parse_date_fn,
) -> list[dict[str, Any]]:
    items = []

    try:
        root = ElementTree.fromstring(xml_content)
    except Exception as error:
        print(f"Yayinci RSS parse edilemedi ({feed_name}): {error}")
        return items

    for node in root.findall("./channel/item"):
        title = (node.findtext("title") or "").strip()
        link = (node.findtext("link") or "").strip()
        description = node.findtext("description") or ""
        published_at = parse_date_fn(node.findtext("pubDate"))

        if not title:
            continue

        lead = extract_cdata_description(description)

        items.append(
            {
                "title": title,
                "source": feed_name,
                "url": link,
                "published_at": published_at.isoformat() if published_at else None,
                "published_at_parsed": published_at,
                "description": lead,
                "summary": lead,
                "raw_description": description,
            }
        )

    return items


def fetch_publisher_news_items(parse_date_fn) -> list[dict[str, Any]]:
    items = []

    for feed in PUBLISHER_RSS_FEEDS:
        try:
            response = make_request_with_retry(
                feed["url"],
                headers={
                    "User-Agent": "YakitRadar/1.0",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                },
            )
            items.extend(parse_publisher_rss_items(response.content, feed["name"], parse_date_fn=parse_date_fn))
        except Exception as error:
            print(f"Yayinci RSS okunamadi ({feed['name']}): {error}")

    return items
