"""Limit Groq market-analysis request payload size."""

from __future__ import annotations

import copy
import json
from typing import Any

GROQ_MAX_NEWS_ITEMS = 20
GROQ_MAX_TEXT_FIELD_CHARS = 480
GROQ_MAX_TOTAL_PAYLOAD_CHARS = 12_000

NEWS_TEXT_FIELDS = (
    "title",
    "summary",
    "description",
    "article_text",
    "raw_description",
    "link",
    "url",
    "source",
)

NEWS_ANALYSIS_KEYS = ("direction", "score", "summary")


def trim_text(value: Any, max_chars: int = GROQ_MAX_TEXT_FIELD_CHARS) -> Any:
    if value is None or not isinstance(value, str):
        return value

    if len(value) <= max_chars:
        return value

    if max_chars <= 1:
        return value[:max_chars]

    return value[: max_chars - 1].rstrip() + "…"


def trim_news_entry(entry: dict[str, Any], max_field_chars: int) -> dict[str, Any]:
    trimmed = dict(entry)

    for field in NEWS_TEXT_FIELDS:
        if field in trimmed:
            trimmed[field] = trim_text(trimmed[field], max_field_chars)

    mentions = trimmed.get("price_mentions")
    if isinstance(mentions, list):
        trimmed["price_mentions"] = [
            trim_text(item, max_field_chars) if isinstance(item, str) else item for item in mentions[:10]
        ]

    extracted = trimmed.get("extracted_amounts")
    if isinstance(extracted, list):
        trimmed["extracted_amounts"] = extracted[:10]

    return trimmed


def slim_news_analysis(analysis: Any) -> dict[str, Any]:
    if not isinstance(analysis, dict):
        return {}

    return {key: analysis[key] for key in NEWS_ANALYSIS_KEYS if key in analysis}


def measure_payload_chars(payload: dict[str, Any]) -> int:
    return len(json.dumps(payload, ensure_ascii=False))


def limit_groq_analysis_payload(
    payload: dict[str, Any],
    *,
    max_news_items: int = GROQ_MAX_NEWS_ITEMS,
    max_field_chars: int = GROQ_MAX_TEXT_FIELD_CHARS,
    max_total_chars: int = GROQ_MAX_TOTAL_PAYLOAD_CHARS,
) -> tuple[dict[str, Any], dict[str, int]]:
    limited = copy.deepcopy(payload)

    news = limited.get("news")
    if isinstance(news, list):
        limited["news"] = [
            trim_news_entry(item, max_field_chars) for item in news[:max_news_items] if isinstance(item, dict)
        ]

    extractions = limited.get("news_amount_extractions")
    if isinstance(extractions, list):
        limited["news_amount_extractions"] = extractions[:max_news_items]

    haberler = limited.get("haberlerde_gecen_tutarlar")
    if isinstance(haberler, list):
        limited["haberlerde_gecen_tutarlar"] = haberler[:max_news_items]

    if "news_analysis" in limited:
        limited["news_analysis"] = slim_news_analysis(limited["news_analysis"])

    while measure_payload_chars(limited) > max_total_chars and len(limited.get("news") or []) > 1:
        limited["news"] = limited["news"][: max(1, len(limited["news"]) // 2)]

    stats = {
        "news_items": len(limited.get("news") or []),
        "payload_chars": measure_payload_chars(limited),
        "max_total_chars": max_total_chars,
    }
    return limited, stats


def shrink_groq_payload_for_retry(payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, int]]:
    news_count = len(payload.get("news") or [])
    half_news = max(1, news_count // 2) if news_count else 1
    half_field_chars = max(120, GROQ_MAX_TEXT_FIELD_CHARS // 2)
    half_total = max(4000, GROQ_MAX_TOTAL_PAYLOAD_CHARS // 2)

    return limit_groq_analysis_payload(
        payload,
        max_news_items=half_news,
        max_field_chars=half_field_chars,
        max_total_chars=half_total,
    )
