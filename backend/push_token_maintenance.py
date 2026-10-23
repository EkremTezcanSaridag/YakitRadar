"""Disable invalid or stale push token rows."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from expo_push_client import is_device_not_registered_error

STALE_TOKEN_MAX_AGE_DAYS = 30


def disable_tokens(supabase, installation_ids: list[str], reason: str) -> int:
    if not installation_ids:
        return 0

    now_iso = datetime.now(timezone.utc).isoformat()
    updated = 0

    for installation_id in installation_ids:
        try:
            supabase.table("push_tokens").update(
                {
                    "enabled": False,
                    "updated_at": now_iso,
                    "disabled_reason": reason,
                }
            ).eq("installation_id", installation_id).execute()
            updated += 1
        except Exception as error:
            print(f"Push token pasiflestirilemedi ({installation_id}): {error}")

    return updated


def disable_tokens_by_expo_push_tokens(supabase, expo_push_tokens: list[str], reason: str) -> int:
    tokens = [token for token in expo_push_tokens if token]
    if not tokens:
        return 0

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        result = (
            supabase.table("push_tokens")
            .update(
                {
                    "enabled": False,
                    "updated_at": now_iso,
                    "disabled_reason": reason,
                }
            )
            .in_("expo_push_token", tokens)
            .execute()
        )
    except Exception as error:
        print(f"Expo push tokenlari pasiflestirilemedi: {error}")
        return 0

    return len(result.data or [])


def apply_delivery_errors(supabase, delivery_errors: list[dict[str, Any]]) -> int:
    disabled = 0
    not_registered_tokens: list[str] = []

    for entry in delivery_errors or []:
        message = str(entry.get("error") or "")
        if is_device_not_registered_error(message):
            token = str(entry.get("expo_push_token") or "").strip()
            if token:
                not_registered_tokens.append(token)

    if not_registered_tokens:
        disabled += disable_tokens_by_expo_push_tokens(
            supabase,
            not_registered_tokens,
            "device_not_registered",
        )

    return disabled


def disable_stale_tokens(supabase, now: datetime | None = None, max_age_days: int = STALE_TOKEN_MAX_AGE_DAYS) -> int:
    reference = now or datetime.now(timezone.utc)
    cutoff = reference - timedelta(days=max_age_days)
    cutoff_iso = cutoff.isoformat()

    try:
        result = (
            supabase.table("push_tokens")
            .update(
                {
                    "enabled": False,
                    "updated_at": reference.isoformat(),
                    "disabled_reason": "stale_last_seen",
                }
            )
            .eq("enabled", True)
            .lt("last_seen_at", cutoff_iso)
            .execute()
        )
    except Exception as error:
        print(f"Eski push tokenlar pasiflestirilemedi: {error}")
        return 0

    count = len(result.data or [])
    if count:
        print(f"{count} push token {max_age_days} gunden eski last_seen_at nedeniyle pasiflestirildi")
    return count
