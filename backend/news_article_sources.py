"""Publisher RSS and optional article body fetch for news amount extraction."""

import os
import re
import time
from html import unescape
from typing import Any
from urllib.parse import urlparse
from xml.etree import ElementTree

import requests

from groq_market_analysis import extract_price_amounts_from_fields
from http_client import make_request_with_retry

ARTICLE_FETCH_TIMEOUT = int(os.getenv("NEWS_ARTICLE_FETCH_TIMEOUT", "3"))
ARTICLE_FETCH_MAX_ITEMS = int(os.getenv("NEWS_ARTICLE_FETCH_MAX", "5"))
ARTICLE_FETCH_BUDGET_SECONDS = int(os.getenv("NEWS_ARTICLE_FETCH_BUDGET_SECONDS", "20"))
ARTICLE_MAX_PARAGRAPHS = 5

PUBLISHER_BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Direct publisher feeds (primary path for lead paragraphs in <description>).
# Sozcu/T24 removed: production RSS returned 503/403 or non-XML payloads.
PUBLISHER_RSS_FEEDS = (
    {
        "name": "Ekonomim Ekonomi",
        "url": "https://www.ekonomim.com/rss/ekonomi.xml",
    },
    {
        "name": "Haberturk Ekonomi",
        "url": "https://www.haberturk.com/rss/ekonomi.xml",
    },
)

PUBLISHER_ARTICLE_FALLBACK_SOURCES = frozenset(
    {feed["name"] for feed in PUBLISHER_RSS_FEEDS}
)

GOOGLE_NEWS_HOST_MARKERS = ("news.google.com",)


def publisher_request_headers() -> dict[str, str]:
    return {
        "User-Agent": PUBLISHER_BROWSER_USER_AGENT,
        "Accept": "application/rss+xml, application/xml, text/xml, */*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }


def article_request_headers() -> dict[str, str]:
    return {
        "User-Agent": PUBLISHER_BROWSER_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    }


class ArticleFetchBudget:
    def __init__(
        self,
        max_requests: int = ARTICLE_FETCH_MAX_ITEMS,
        max_seconds: float = ARTICLE_FETCH_BUDGET_SECONDS,
    ) -> None:
        self.max_requests = max_requests
        self.max_seconds = max_seconds
        self.requests_made = 0
        self.started_at = time.monotonic()

    def can_fetch(self) -> bool:
        if self.requests_made >= self.max_requests:
            return False

        return (time.monotonic() - self.started_at) <= self.max_seconds

    def record_request(self) -> None:
        self.requests_made += 1


def is_google_news_url(url: str) -> bool:
    if not url:
        return False

    host = urlparse(url).netloc.lower()

    return any(marker in host for marker in GOOGLE_NEWS_HOST_MARKERS)


def is_valid_rss_xml(content: bytes) -> bool:
    if not content or not content.strip():
        return False

    try:
        ElementTree.fromstring(content)
    except Exception:
        return False

    return True


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


def fetch_article_body_with_status(url: str, budget: ArticleFetchBudget | None = None) -> tuple[str | None, int | None, str | None]:
    if not url or is_google_news_url(url):
        return None, None, "google_news_url"

    if budget is not None and not budget.can_fetch():
        return None, None, "budget_exhausted"

    try:
        if budget is not None:
            budget.record_request()

        response = requests.get(
            url,
            headers=article_request_headers(),
            timeout=ARTICLE_FETCH_TIMEOUT,
            allow_redirects=True,
        )
        status = response.status_code
    except requests.RequestException as error:
        return None, None, str(error)

    final_url = response.url or url

    if is_google_news_url(final_url):
        return None, status, "redirected_to_google_news"

    if status >= 400:
        return None, status, "http_error"

    body = extract_paragraph_text_from_html(response.text)

    if not body:
        return None, status, "empty_body"

    return body, status, None


def description_fields_have_amounts(item: dict[str, Any], normalize_text_fn) -> bool:
    return bool(
        extract_price_amounts_from_fields(
            None,
            None,
            item.get("description"),
            normalize_text_fn,
        )
    )


def should_fetch_publisher_article(item: dict[str, Any], normalize_text_fn) -> bool:
    source = (item.get("source") or "").strip()

    if source not in PUBLISHER_ARTICLE_FALLBACK_SOURCES:
        return False

    if item.get("feed_origin") != "publisher":
        return False

    if description_fields_have_amounts(item, normalize_text_fn):
        return False

    url = (item.get("url") or "").strip()

    return bool(url) and not is_google_news_url(url)


def enrich_items_with_article_bodies(
    items: list[dict[str, Any]],
    *,
    normalize_text_fn,
    max_items: int = ARTICLE_FETCH_MAX_ITEMS,
    budget_seconds: float = ARTICLE_FETCH_BUDGET_SECONDS,
) -> list[dict[str, Any]]:
    budget = ArticleFetchBudget(max_requests=max_items, max_seconds=budget_seconds)
    enriched = []

    for item in items:
        copy = dict(item)

        if should_fetch_publisher_article(copy, normalize_text_fn):
            source = copy.get("source") or "yayinci"
            body, status, error = fetch_article_body_with_status(copy.get("url") or "", budget=budget)
            amounts = []

            if body:
                copy["article_text"] = body
                amounts = extract_price_amounts_from_fields(
                    copy.get("title"),
                    copy.get("summary"),
                    copy.get("description"),
                    normalize_text_fn,
                    body,
                )

            print(
                "Haber makale cekimi: "
                f"kaynak={source} durum={status} tutar_sayisi={len(amounts)} "
                f"hata={error or 'yok'}"
            )
        elif copy.get("feed_origin") == "publisher" and description_fields_have_amounts(copy, normalize_text_fn):
            print(
                "Haber makale cekimi atlandi: "
                f"kaynak={copy.get('source')!r} aciklama_tutarli=evet"
            )

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
                headers=publisher_request_headers(),
            )
        except Exception as error:
            print(f"Yayinci RSS okunamadi ({feed['name']}): {error}")
            continue

        if response.status_code >= 400 or not is_valid_rss_xml(response.content):
            print(
                "Yayinci RSS atlandi: "
                f"kaynak={feed['name']} durum={response.status_code} gecerli_xml=degil"
            )
            continue

        items.extend(parse_publisher_rss_items(response.content, feed["name"], parse_date_fn=parse_date_fn))

    return items
