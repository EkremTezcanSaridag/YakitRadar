"""Skip scheduled scraper runs when Supabase fiyatlar were updated recently."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

SCHEDULE_FRESHNESS_MAX_AGE_MINUTES = 45
GUNCELLEME_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})")


def parse_guncelleme_istanbul(value: str) -> datetime | None:
    match = GUNCELLEME_RE.match(str(value or "").strip())

    if not match:
        return None

    year, month, day, hour, minute = match.groups()
    instant = datetime(
        int(year),
        int(month),
        int(day),
        int(hour),
        int(minute),
        tzinfo=timezone(timedelta(hours=3)),
    )

    return instant


def should_skip_scheduled_scrape(
    latest_guncelleme: datetime | None,
    *,
    now: datetime | None = None,
    max_age_minutes: int = SCHEDULE_FRESHNESS_MAX_AGE_MINUTES,
) -> bool:
    if latest_guncelleme is None:
        return False

    reference = now or datetime.now(timezone.utc)
    latest_utc = latest_guncelleme.astimezone(timezone.utc)
    age = reference - latest_utc

    return age <= timedelta(minutes=max_age_minutes)


def resolve_supabase_key() -> str:
    return (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.environ.get("SUPABASE_KEY", "").strip()
    )


def fetch_latest_guncelleme(supabase_url: str, supabase_key: str) -> str | None:
    base = supabase_url.rstrip("/")
    query = "/rest/v1/fiyatlar?select=guncelleme&order=guncelleme.desc&limit=1"
    request = urllib.request.Request(
        f"{base}{query}",
        headers={
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Accept": "application/json",
        },
        method="GET",
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if not isinstance(payload, list) or not payload:
        return None

    row = payload[0]
    if not isinstance(row, dict):
        return None

    value = row.get("guncelleme")
    return str(value) if value else None


def evaluate_schedule_gate(
    *,
    supabase_url: str,
    supabase_key: str,
    now: datetime | None = None,
) -> dict[str, str | bool]:
    if not supabase_url or not supabase_key:
        return {"skip": False, "reason": "missing_supabase_config"}

    try:
        latest_raw = fetch_latest_guncelleme(supabase_url, supabase_key)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return {"skip": False, "reason": "freshness_lookup_failed"}

    latest = parse_guncelleme_istanbul(latest_raw or "")
    skip = should_skip_scheduled_scrape(latest, now=now)

    return {
        "skip": skip,
        "reason": "data_fresh" if skip else "data_stale_or_unknown",
        "latest_guncelleme": latest_raw or "",
    }


def main() -> int:
    result = evaluate_schedule_gate(
        supabase_url=os.environ.get("SUPABASE_URL", "").strip(),
        supabase_key=resolve_supabase_key(),
    )

    skip = "true" if result.get("skip") else "false"
    print(f"skip={skip}")
    print(f"reason={result.get('reason', '')}")

    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        with open(output_path, "a", encoding="utf-8") as handle:
            handle.write(f"skip={skip}\n")
            handle.write(f"reason={result.get('reason', '')}\n")

    if result.get("skip"):
        print("Zamanlanmis kosu atlandi: fiyatlar yeterince guncel.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
