"""Guards for scraped fuel prices before Supabase writes."""

from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Any, Mapping, Sequence

BULK_PRICE_DEVIATION_RATIO = 0.10
BULK_PRICE_DEVIATION_MAJORITY = 0.50
LPG_BULK_PRICE_DEVIATION_RATIO = 0.25
MIN_SCRAPED_CITY_COUNT = 75
AKARYAKIT_HEADER_SCAN_CHARS = 2500

FUEL_FIELDS_FOR_SANITY = ("benzin_95", "motorin", "lpg")

# LPG is more volatile than benzin/motorin (tax adjustments can move it >20% in
# one step), so it uses a wider deviation window. Benzin/motorin keep the strict
# 10% window; a suspicious field is withheld without blocking the other fields.
FIELD_DEVIATION_RATIOS = {
    "benzin_95": BULK_PRICE_DEVIATION_RATIO,
    "motorin": BULK_PRICE_DEVIATION_RATIO,
    "lpg": LPG_BULK_PRICE_DEVIATION_RATIO,
}


class PriceSanityError(RuntimeError):
    """Raised when scraped prices fail bulk sanity checks."""


class PriceSourceValidationError(RuntimeError):
    """Raised when the source page structure or metadata is invalid."""


def is_price_sanity_override_enabled(env: Mapping[str, str] | None = None) -> bool:
    source = env if env is not None else os.environ
    value = str(source.get("PRICE_SANITY_OVERRIDE", "")).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _parse_price(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace("TL", "").replace("₺", "").replace(" ", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def deviation_ratio(old_price: float, new_price: float) -> float:
    if old_price <= 0:
        return 0.0
    return abs(new_price - old_price) / old_price


def bulk_deviation_stats(
    previous_by_city: Mapping[str, Mapping[str, Any]],
    new_by_city: Mapping[str, Mapping[str, Any]],
    field: str,
    ratio_threshold: float = BULK_PRICE_DEVIATION_RATIO,
) -> dict[str, int | float]:
    comparable = 0
    deviating = 0

    for city, new_row in new_by_city.items():
        previous_row = previous_by_city.get(city)
        if not previous_row:
            continue

        old_price = _parse_price(previous_row.get(field))
        new_price = _parse_price(new_row.get(field))
        if old_price is None or new_price is None:
            continue

        comparable += 1
        if deviation_ratio(old_price, new_price) > ratio_threshold:
            deviating += 1

    share = (deviating / comparable) if comparable else 0.0
    return {
        "comparable": comparable,
        "deviating": deviating,
        "deviating_share": share,
    }


def evaluate_bulk_price_deviation(
    previous_by_city: Mapping[str, Mapping[str, Any]],
    new_by_city: Mapping[str, Mapping[str, Any]],
    *,
    env: Mapping[str, str] | None = None,
    ratio_by_field: Mapping[str, float] | None = None,
) -> dict[str, Any]:
    """Build a per-fuel sanity report without raising.

    A field is marked ``blocked`` when more than half of the comparable cities
    move beyond that field's ratio window. Callers can then keep the previous
    values for blocked fields instead of aborting the whole price update.
    """
    override = is_price_sanity_override_enabled(env)
    ratios = ratio_by_field or FIELD_DEVIATION_RATIOS
    fields: dict[str, dict[str, Any]] = {}
    blocked_fields: list[str] = []

    if previous_by_city and not override:
        for field in FUEL_FIELDS_FOR_SANITY:
            ratio_threshold = ratios.get(field, BULK_PRICE_DEVIATION_RATIO)
            stats = bulk_deviation_stats(previous_by_city, new_by_city, field, ratio_threshold)
            blocked = (
                stats["comparable"] > 0
                and stats["deviating_share"] > BULK_PRICE_DEVIATION_MAJORITY
            )
            fields[field] = {
                **stats,
                "ratio_threshold": ratio_threshold,
                "blocked": blocked,
            }
            if blocked:
                blocked_fields.append(field)

    return {
        "override": override,
        "blocked_fields": blocked_fields,
        "fields": fields,
    }


def price_sanity_warnings(report: Mapping[str, Any]) -> list[str]:
    """Human readable warnings for blocked fields."""
    warnings: list[str] = []
    for field in report.get("blocked_fields", []):
        stats = report.get("fields", {}).get(field, {})
        warnings.append(
            f"{field}: {stats.get('deviating', 0)}/{stats.get('comparable', 0)} il "
            f"%{stats.get('ratio_threshold', BULK_PRICE_DEVIATION_RATIO) * 100:.0f} "
            "esigini asti; eski deger korunuyor"
        )
    return warnings


def apply_price_sanity_guard(
    previous_by_city: Mapping[str, Mapping[str, Any]],
    new_by_city: Mapping[str, Mapping[str, Any]],
    *,
    env: Mapping[str, str] | None = None,
    ratio_by_field: Mapping[str, float] | None = None,
) -> tuple[Mapping[str, Mapping[str, Any]], dict[str, Any]]:
    """Return price data safe to write plus a per-fuel sanity report.

    Blocked fields keep their previous values so a single volatile fuel (LPG)
    cannot freeze benzin/motorin updates. New cities without a previous value
    keep the freshly scraped value even when their field is blocked.
    """
    report = evaluate_bulk_price_deviation(
        previous_by_city,
        new_by_city,
        env=env,
        ratio_by_field=ratio_by_field,
    )
    blocked_fields = report["blocked_fields"]

    if not blocked_fields:
        return new_by_city, report

    sanitized: dict[str, Mapping[str, Any]] = {}
    for city, row in new_by_city.items():
        fixed = dict(row)
        previous_row = previous_by_city.get(city)
        if previous_row:
            for field in blocked_fields:
                old_value = previous_row.get(field)
                if old_value is not None:
                    fixed[field] = old_value
        sanitized[city] = fixed

    return sanitized, report


def assert_bulk_price_deviation_ok(
    previous_by_city: Mapping[str, Mapping[str, Any]],
    new_by_city: Mapping[str, Mapping[str, Any]],
    *,
    env: Mapping[str, str] | None = None,
) -> None:
    report = evaluate_bulk_price_deviation(previous_by_city, new_by_city, env=env)
    if report["blocked_fields"]:
        raise PriceSanityError(
            "Bulk price deviation check failed; Supabase write aborted. "
            + "; ".join(price_sanity_warnings(report))
        )


def validate_gecmis_daily_deltas(
    benzin_degisim: float,
    motorin_degisim: float,
    lpg_degisim: float,
    max_daily_change: float,
    *,
    lpg_max_daily_change: float | None = None,
    env: Mapping[str, str] | None = None,
) -> None:
    if is_price_sanity_override_enabled(env):
        return

    lpg_limit = max_daily_change if lpg_max_daily_change is None else lpg_max_daily_change
    for label, value, limit in (
        ("benzin_degisim", benzin_degisim, max_daily_change),
        ("motorin_degisim", motorin_degisim, max_daily_change),
        ("lpg_degisim", lpg_degisim, lpg_limit),
    ):
        if abs(value) > limit:
            raise PriceSanityError(
                f"Gecmis {label} change {value} exceeds limit {limit}; record rejected"
            )


def _header_cells(table) -> list[str]:
    header_row = table.find("thead")
    if header_row:
        row = header_row.find("tr")
    else:
        row = table.find("tr")

    if row is None:
        return []

    return [cell.get_text(" ", strip=True).lower() for cell in row.find_all(["th", "td"])]


def validate_aytemiz_akaryakit_page(soup) -> None:
    """Ensure Benzin appears before Motorin in a table header (LPG is on a separate page)."""
    for table in soup.find_all("table"):
        cells = _header_cells(table)
        if len(cells) < 2:
            continue

        joined = " ".join(cells)
        benzin_index = joined.find("benzin")
        motorin_index = joined.find("motorin")

        if benzin_index == -1 or motorin_index == -1:
            continue

        if benzin_index > motorin_index:
            raise PriceSourceValidationError("Akaryakit table columns are not in Benzin, Motorin order")

        validate_source_update_date_if_present(soup.get_text(" ", strip=True))
        return

    header_text = soup.get_text(" ", strip=True).lower()[:AKARYAKIT_HEADER_SCAN_CHARS]
    benzin_index = header_text.find("benzin")
    motorin_index = header_text.find("motorin")

    if benzin_index == -1 or motorin_index == -1 or benzin_index > motorin_index:
        raise PriceSourceValidationError("Akaryakit page header missing or misordered Benzin/Motorin labels")

    validate_source_update_date_if_present(soup.get_text(" ", strip=True))


def validate_aytemiz_lpg_page(soup) -> None:
    lpg_table = next(
        (table for table in soup.find_all("table") if "oto lpg" in table.get_text(" ", strip=True).lower()),
        None,
    )

    if lpg_table is None:
        raise PriceSourceValidationError("LPG page missing Oto LPG table")

    cells = _header_cells(lpg_table)
    joined = " ".join(cells)
    if "lpg" not in joined and "oto" not in joined:
        raise PriceSourceValidationError("LPG table header does not mention LPG/Oto LPG")


def validate_source_update_date_if_present(page_text: str, *, now: datetime | None = None) -> None:
    match = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", page_text)
    if not match:
        return

    day, month, year = (int(match.group(1)), int(match.group(2)), int(match.group(3)))
    try:
        page_date = datetime(year, month, day)
    except ValueError as error:
        raise PriceSourceValidationError("Source page update date is invalid") from error

    reference = now or datetime.now()
    if (reference - page_date).days > 30:
        raise PriceSourceValidationError("Source page update date is older than 30 days")


def assert_scraped_city_count(city_count: int, minimum: int = MIN_SCRAPED_CITY_COUNT) -> None:
    if city_count < minimum:
        raise PriceSourceValidationError(f"Scraped city count {city_count} is below minimum {minimum}")


def log_scrape_failure_summary(
    source_kind: str,
    response: Any,
    *,
    match_count: int = 0,
    sample_rows: Sequence[str] | None = None,
) -> None:
    status_code = getattr(response, "status_code", "unknown")
    body = getattr(response, "text", "") or ""
    snippet = re.sub(r"\s+", " ", body[:300])
    samples = list(sample_rows or [])[:5]
    print(
        f"KAYNAK HATA [{source_kind}]: http_status={status_code} "
        f"body_length={len(body)} match_count={match_count} "
        f"snippet={snippet!r} samples={samples}"
    )
