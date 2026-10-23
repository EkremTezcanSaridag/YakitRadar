"""Pure helpers for push notification eligibility and dedupe keys."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

DEFAULT_PENDING_PRICE_MAX_AGE = timedelta(hours=24)

CONFIDENCE_RANK = {
    "low": 0,
    "medium": 1,
    "high": 2,
}

FUEL_ALIASES = {
    "benzin": "benzin",
    "benzin 95": "benzin",
    "benzin95": "benzin",
    "motorin": "motorin",
    "lpg": "lpg",
}


def normalize_confidence(value: Any) -> str:
    normalized = str(value or "low").strip().lower()
    return normalized if normalized in CONFIDENCE_RANK else "low"


def confidence_meets_minimum(value: Any, minimum: str = "medium") -> bool:
    return CONFIDENCE_RANK[normalize_confidence(value)] >= CONFIDENCE_RANK[normalize_confidence(minimum)]


def istanbul_quiet_hours_active(now: datetime) -> bool:
    hour = now.hour
    return hour >= 22 or hour < 8


def pending_queue_flush_allowed(now: datetime) -> bool:
    """Pending price notifications may be sent once Istanbul quiet hours ended (08:00+)."""
    return not istanbul_quiet_hours_active(now)


def normalize_fuel_key(value: Any) -> str:
    label = str(value or "").strip().lower()
    return FUEL_ALIASES.get(label, label)


def parse_signals_field(signals_field: Any) -> list[dict[str, Any]]:
    if not signals_field:
        return []

    if isinstance(signals_field, str):
        try:
            parsed = json.loads(signals_field)
        except json.JSONDecodeError:
            return []
        signals_field = parsed

    if not isinstance(signals_field, list):
        return []

    return [item for item in signals_field if isinstance(item, dict)]


def count_supporting_news_sources(analysis: dict[str, Any] | None, fuel: str) -> int:
    if not analysis:
        return 0

    fuel_key = normalize_fuel_key(fuel)
    sources: set[str] = set()

    for entry in analysis.get("news_amount_extractions") or []:
        if not isinstance(entry, dict):
            continue

        entry_fuel = normalize_fuel_key(entry.get("fuel"))
        if entry_fuel and entry_fuel != fuel_key:
            continue

        source_key = str(entry.get("source") or entry.get("title") or entry.get("url") or "").strip()
        if source_key:
            sources.add(source_key.lower())

    return len(sources)


def is_single_source_low_confidence_signal(
    market_row: dict[str, Any],
    signal_entry: dict[str, Any],
) -> bool:
    signal_confidence = normalize_confidence(
        signal_entry.get("confidence") or market_row.get("confidence"),
    )

    if signal_confidence != "low":
        return False

    analysis = market_row.get("analysis") or {}
    return count_supporting_news_sources(analysis, signal_entry.get("fuel")) <= 1


def expected_amount_tl(signal_entry: dict[str, Any]) -> float | None:
    raw = signal_entry.get("expected_amount_tl")
    if raw is None:
        raw = signal_entry.get("expected_amount")

    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None

    if value == 0:
        return None

    return value


def should_notify_expected_change(
    market_row: dict[str, Any],
    signal_entry: dict[str, Any],
) -> bool:
    if not confidence_meets_minimum(market_row.get("confidence"), "medium"):
        return False

    if not confidence_meets_minimum(signal_entry.get("confidence") or market_row.get("confidence"), "medium"):
        return False

    if str(signal_entry.get("direction") or "neutral").strip().lower() == "neutral":
        return False

    if expected_amount_tl(signal_entry) is None:
        return False

    if is_single_source_low_confidence_signal(market_row, signal_entry):
        return False

    return True


def filter_expected_change_signals(market_row: dict[str, Any]) -> list[dict[str, Any]]:
    eligible: list[dict[str, Any]] = []

    for signal_entry in parse_signals_field(market_row.get("signals")):
        if should_notify_expected_change(market_row, signal_entry):
            eligible.append(signal_entry)

    return eligible


def price_change_dedupe_key(change: dict[str, Any], signal_date: str) -> str:
    city = str(change.get("city") or "").strip().lower()
    fuel = str(change.get("fuel") or "").strip().lower()
    new_price = change.get("new_price")
    old_price = change.get("old_price")
    return f"price:{signal_date}:{city}:{fuel}:{old_price}:{new_price}"


def expected_change_dedupe_key(signal_date: str, fuel: str) -> str:
    return f"expected:{signal_date}:{normalize_fuel_key(fuel)}"


def fuel_matches_tracked(fuel: str, tracked_fuels: list[str]) -> bool:
    if not tracked_fuels:
        return True

    fuel_key = normalize_fuel_key(fuel)
    return any(normalize_fuel_key(item) == fuel_key for item in tracked_fuels)


def parse_pending_detected_at(value: Any) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value

    text = str(value).strip()
    if not text:
        return None

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_pending_price_change_stale(
    detected_at: Any,
    now: datetime,
    max_age: timedelta = DEFAULT_PENDING_PRICE_MAX_AGE,
) -> bool:
    """True when the pending row must not be sent (missing/invalid or older than max_age)."""
    parsed = parse_pending_detected_at(detected_at)
    if parsed is None:
        return True

    reference = now
    if parsed.tzinfo is None and reference.tzinfo is not None:
        parsed = parsed.replace(tzinfo=reference.tzinfo)
    elif parsed.tzinfo is not None and reference.tzinfo is None:
        reference = reference.replace(tzinfo=parsed.tzinfo)
    elif parsed.tzinfo is not None and reference.tzinfo is not None:
        parsed = parsed.astimezone(reference.tzinfo)

    return reference - parsed > max_age


def dedupe_price_changes(changes: list[dict[str, Any]], signal_date: str) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}

    for change in changes:
        if not change:
            continue

        key = price_change_dedupe_key(change, signal_date)
        merged[key] = change

    return list(merged.values())
