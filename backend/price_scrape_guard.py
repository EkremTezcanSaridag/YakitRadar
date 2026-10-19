"""Guards for scraped fuel prices before Supabase writes."""

from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Any, Mapping, Sequence

BULK_PRICE_DEVIATION_RATIO = 0.10
BULK_PRICE_DEVIATION_MAJORITY = 0.50
MIN_SCRAPED_CITY_COUNT = 75
AKARYAKIT_HEADER_SCAN_CHARS = 2500

FUEL_FIELDS_FOR_SANITY = ("benzin_95", "motorin", "lpg")


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


def assert_bulk_price_deviation_ok(
    previous_by_city: Mapping[str, Mapping[str, Any]],
    new_by_city: Mapping[str, Mapping[str, Any]],
    *,
    env: Mapping[str, str] | None = None,
) -> None:
    if is_price_sanity_override_enabled(env):
        return

    if not previous_by_city:
        return

    failures: list[str] = []

    for field in FUEL_FIELDS_FOR_SANITY:
        stats = bulk_deviation_stats(previous_by_city, new_by_city, field)
        if stats["comparable"] == 0:
            continue

        if stats["deviating_share"] > BULK_PRICE_DEVIATION_MAJORITY:
            failures.append(
                f"{field}: {stats['deviating']}/{stats['comparable']} cities exceed "
                f"{BULK_PRICE_DEVIATION_RATIO * 100:.0f}% change"
            )

    if failures:
        raise PriceSanityError(
            "Bulk price deviation check failed; Supabase write aborted. "
            + "; ".join(failures)
        )


def validate_gecmis_daily_deltas(
    benzin_degisim: float,
    motorin_degisim: float,
    lpg_degisim: float,
    max_daily_change: float,
) -> None:
    for label, value in (
        ("benzin_degisim", benzin_degisim),
        ("motorin_degisim", motorin_degisim),
        ("lpg_degisim", lpg_degisim),
    ):
        if abs(value) > max_daily_change:
            raise PriceSanityError(
                f"Gecmis {label} change {value} exceeds limit {max_daily_change}; record rejected"
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
