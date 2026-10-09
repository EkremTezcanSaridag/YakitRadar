"""Groq market analysis helpers: news prep, context, signal parsing, summaries."""

import re
from datetime import datetime, timedelta
from typing import Any

ALLOWED_SIGNAL_FUELS = frozenset({"Benzin", "Motorin", "LPG"})
FUEL_FIELD_MAP = {
    "Benzin": "benzin_95",
    "Motorin": "motorin",
    "LPG": "lpg",
}
DEFAULT_TIMING = "Gündemde değişim yok"
DEFAULT_CONFIDENCE = "low"
NEWS_TITLE_SOURCE_SUFFIX = re.compile(r"\s+[-–—]\s+.+$")
BU_GECE_KEYWORDS = ("bu gece", "bu gece yarisi", "bu gece yarısı")


def strip_news_title_source_suffix(title: str) -> str:
    if not title:
        return ""

    stripped = NEWS_TITLE_SOURCE_SUFFIX.sub("", title).strip()
    return stripped or title.strip()


def most_recent_istanbul_midnight(now: datetime) -> datetime:
    local = now.astimezone(now.tzinfo)
    midnight = local.replace(hour=0, minute=0, second=0, microsecond=0)
    if local > midnight:
        return midnight
    return midnight - timedelta(days=1)


def headline_age_hours(published_at: datetime | None, now: datetime) -> float | None:
    if published_at is None:
        return None

    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=now.tzinfo)

    delta = now - published_at.astimezone(now.tzinfo)
    return round(max(0.0, delta.total_seconds() / 3600), 2)


def title_implies_bu_gece(normalized_title: str) -> bool:
    return any(keyword in normalized_title for keyword in BU_GECE_KEYWORDS)


def is_bu_gece_already_applied(normalized_title: str, published_at: datetime | None, now: datetime) -> bool:
    if not title_implies_bu_gece(normalized_title) or published_at is None:
        return False

    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=now.tzinfo)

    return published_at.astimezone(now.tzinfo) < most_recent_istanbul_midnight(now)


def enrich_news_item(item: dict[str, Any], now: datetime, normalize_text_fn) -> dict[str, Any]:
    title = strip_news_title_source_suffix(item.get("title") or "")
    normalized_title = normalize_text_fn(title)
    published_at = item.get("published_at_parsed")

    enriched = dict(item)
    enriched["title"] = title
    enriched["normalized_title"] = normalized_title
    enriched["age_hours"] = headline_age_hours(published_at, now)
    enriched["bu_gece_already_applied"] = is_bu_gece_already_applied(
        normalized_title,
        published_at,
        now,
    )
    return enriched


def compute_pump_averages(price_rows: list[dict[str, Any]], parse_float_fn) -> dict[str, float | None]:
    benzin_vals = []
    motorin_vals = []
    lpg_vals = []

    for row in price_rows:
        benzin = parse_float_fn(row.get("benzin_95"))
        motorin = parse_float_fn(row.get("motorin"))
        lpg = parse_float_fn(row.get("lpg"))

        if benzin is not None:
            benzin_vals.append(benzin)
        if motorin is not None:
            motorin_vals.append(motorin)
        if lpg is not None:
            lpg_vals.append(lpg)

    def average(values: list[float]) -> float | None:
        if not values:
            return None
        return round(sum(values) / len(values), 2)

    return {
        "Benzin": average(benzin_vals),
        "Motorin": average(motorin_vals),
        "LPG": average(lpg_vals),
        "city_count": len(price_rows),
    }


def format_gecmis_trend(gecmis_rows: list[dict[str, Any]], parse_float_fn) -> list[dict[str, Any]]:
    trend = []

    for row in gecmis_rows:
        trend.append(
            {
                "date": row.get("tarih"),
                "benzin_tl": parse_float_fn(row.get("benzin_95")),
                "motorin_tl": parse_float_fn(row.get("motorin")),
                "lpg_tl": parse_float_fn(row.get("lpg")),
                "benzin_change_tl": parse_float_fn(row.get("benzin_degisim")),
                "motorin_change_tl": parse_float_fn(row.get("motorin_degisim")),
                "lpg_change_tl": parse_float_fn(row.get("lpg_degisim")),
            }
        )

    return trend


def macro_change_percent(history: list[dict[str, Any]], value_field: str) -> float | None:
    if len(history) < 2:
        return None

    current = history[-1].get(value_field)
    previous = history[-2].get(value_field)

    if current is None or previous in (None, 0):
        return None

    return round(((float(current) - float(previous)) / float(previous)) * 100, 2)


def build_macro_snapshot(brent_history: list[dict[str, Any]], usd_history: list[dict[str, Any]]) -> dict[str, Any]:
    brent_latest = brent_history[-1] if brent_history else None
    usd_latest = usd_history[-1] if usd_history else None

    return {
        "brent_usd": brent_latest.get("price") if brent_latest else None,
        "brent_change_pct": macro_change_percent(
            [{"price": item.get("price")} for item in brent_history],
            "price",
        ),
        "usd_try": usd_latest.get("rate") if usd_latest else None,
        "usd_try_change_pct": macro_change_percent(
            [{"price": item.get("rate")} for item in usd_history],
            "price",
        ),
    }


def parse_expected_amount_tl(value: Any) -> float | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        number = float(value)
    else:
        normalized = str(value).strip().replace(",", ".")
        if not normalized:
            return None
        try:
            number = float(normalized)
        except ValueError:
            return None

    if not (number == number and abs(number) != float("inf")):
        return None

    return round(number, 2)


def normalize_signal_fuel(fuel: Any) -> str | None:
    if fuel is None:
        return None

    name = str(fuel).strip()

    if name in ALLOWED_SIGNAL_FUELS:
        return name

    aliases = {
        "LPG (Otogaz)": "LPG",
        "Otogaz": "LPG",
    }

    return aliases.get(name)


def normalize_signal_direction(direction: Any) -> str:
    value = str(direction or "neutral").strip().lower()

    if value in {"increase", "artis", "artış", "up", "zam"}:
        return "increase"

    if value in {"decrease", "indirim", "down", "dusus", "düşüş"}:
        return "decrease"

    return "neutral"


def parse_groq_fuel_signals(
    parsed: dict[str, Any],
    current_prices: dict[str, float | None],
) -> list[dict[str, Any]]:
    raw_signals = parsed.get("signals")

    if not isinstance(raw_signals, list):
        return build_neutral_fuel_signals(current_prices)

    by_fuel: dict[str, dict[str, Any]] = {}

    for entry in raw_signals:
        if not isinstance(entry, dict):
            continue

        fuel = normalize_signal_fuel(entry.get("fuel"))

        if fuel is None:
            continue

        direction = normalize_signal_direction(entry.get("direction"))
        amount = parse_expected_amount_tl(entry.get("expected_amount_tl"))
        current_price = current_prices.get(fuel)

        if direction not in {"increase", "decrease"}:
            direction = "neutral"
            amount = None

        if amount is not None and direction == "neutral":
            direction = "increase" if amount > 0 else "decrease" if amount < 0 else "neutral"

        if direction == "neutral":
            amount = None

        expected_price = None
        if current_price is not None and amount is not None:
            expected_price = round(current_price + amount, 2)

        by_fuel[fuel] = {
            "fuel": fuel,
            "direction": direction,
            "expected_amount_tl": amount,
            "expected_amount": amount,
            "current_price": current_price,
            "expected_price": expected_price,
            "reason": str(entry.get("reason") or "").strip(),
        }

    return [
        by_fuel.get(
            fuel,
            {
                "fuel": fuel,
                "direction": "neutral",
                "expected_amount_tl": None,
                "expected_amount": None,
                "current_price": current_prices.get(fuel),
                "expected_price": None,
                "reason": "",
            },
        )
        for fuel in ("Benzin", "Motorin", "LPG")
    ]


def build_neutral_fuel_signals(current_prices: dict[str, float | None]) -> list[dict[str, Any]]:
    return [
        {
            "fuel": fuel,
            "direction": "neutral",
            "expected_amount_tl": None,
            "expected_amount": None,
            "current_price": current_prices.get(fuel),
            "expected_price": None,
            "reason": "",
        }
        for fuel in ("Benzin", "Motorin", "LPG")
    ]


def format_tl_amount(value: float | None) -> str:
    if value is None:
        return "--"

    return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def format_signed_tl_amount(value: float | None) -> str:
    if value is None:
        return ""

    prefix = "+" if value > 0 else ""
    return f"{prefix}{format_tl_amount(value)}"


def build_numeric_summary_from_signals(signals: list[dict[str, Any]]) -> str | None:
    candidates = [
        signal
        for signal in signals
        if signal.get("direction") in {"increase", "decrease"}
        and signal.get("current_price") is not None
        and signal.get("expected_amount_tl") is not None
    ]

    if not candidates:
        return None

    signal = candidates[0]
    fuel = signal.get("fuel", "Yakıt")
    current_price = signal["current_price"]
    expected_price = signal.get("expected_price")
    amount = signal["expected_amount_tl"]
    reason = signal.get("reason") or "haber analizi"

    if expected_price is None:
        return (
            f"{fuel} {format_tl_amount(current_price)} ₺, beklenen hareket "
            f"{format_signed_tl_amount(amount)} ₺, kaynak: {reason}"
        )

    return (
        f"{fuel} {format_tl_amount(current_price)} ₺ → yaklaşık {format_tl_amount(expected_price)} ₺ "
        f"({format_signed_tl_amount(amount)}), kaynak: {reason}"
    )


def derive_overall_direction(signals: list[dict[str, Any]]) -> str:
    scored = [
        signal
        for signal in signals
        if signal.get("direction") in {"increase", "decrease"}
        and signal.get("expected_amount_tl") is not None
    ]

    if not scored:
        return "neutral"

    scored.sort(key=lambda item: abs(float(item.get("expected_amount_tl") or 0)), reverse=True)
    return scored[0]["direction"]


def build_mobile_fuel_signals(
    parsed_signals: list[dict[str, Any]],
    confidence: str,
    score: int,
    timing: str | None = None,
) -> list[dict[str, Any]]:
    timing_value = timing or DEFAULT_TIMING
    mobile_signals = []

    for signal in parsed_signals:
        direction = signal.get("direction", "neutral")
        fuel = signal.get("fuel", "Yakıt")
        amount = signal.get("expected_amount")

        if direction == "neutral":
            fuel_score = 0
            fuel_confidence = DEFAULT_CONFIDENCE
            fuel_timing = DEFAULT_TIMING
            fuel_amount = 0.0
        else:
            fuel_score = max(score, 85)
            fuel_confidence = confidence or DEFAULT_CONFIDENCE
            fuel_timing = timing_value if timing_value != DEFAULT_TIMING else "Bu gece yarısı"
            fuel_amount = amount if amount is not None else 0.0

        mobile_signals.append(
            {
                "fuel": fuel,
                "direction": direction,
                "confidence": fuel_confidence,
                "score": fuel_score,
                "label": "artis baskisi" if direction == "increase" else "indirim baskisi" if direction == "decrease" else "notr",
                "expected_amount": fuel_amount,
                "expected_amount_tl": signal.get("expected_amount_tl"),
                "current_price": signal.get("current_price"),
                "expected_price": signal.get("expected_price"),
                "reason": signal.get("reason", ""),
                "timing": fuel_timing,
            }
        )

    return mobile_signals
