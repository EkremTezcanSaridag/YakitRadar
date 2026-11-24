"""Beklenen fiyat değişiminin gerçekleşip gerçekleşmediğini eşleştirir.

Haber analizi "5.20 TL LPG zammı bekleniyor" der; ertesi gün pompa fiyatı
değiştiğinde bu modül beklenti ile gerçekleşen değişimi karşılaştırır. Yalnızca
saf hesaplama yapar; Supabase/ağ erişimi çağıran taraftadır.
"""

from __future__ import annotations

from statistics import median
from typing import Any, Iterable

from notification_rules import expected_amount_tl, normalize_fuel_key

DEFAULT_REALIZED_TOLERANCE_TL = 0.75
DEFAULT_REALIZED_TOLERANCE_RATIO = 0.35
DEFAULT_EXPECTATION_LOOKBACK_DAYS = 3

IGNORED_CHANGE_SOURCES = frozenset({"expected_change", "price_memory"})


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def actual_change_by_fuel(changes: Iterable[dict[str, Any]] | None) -> dict[str, dict[str, Any]]:
    """Şehir bazlı gerçek değişimlerden yakıt başına medyan değişimi çıkarır.

    Medyan kullanılır: tek bir ildeki yuvarlama farkı ulusal beklentiyi bozmasın.
    ``price_memory`` ve ``expected_change`` satırları gerçek değişim sayılmaz.
    """
    grouped: dict[str, dict[str, Any]] = {}

    for change in changes or []:
        if not change or change.get("source") in IGNORED_CHANGE_SOURCES:
            continue

        diff = _to_float(change.get("diff"))
        if diff is None or diff == 0:
            continue

        fuel_key = normalize_fuel_key(change.get("fuel"))
        if not fuel_key:
            continue

        entry = grouped.get(fuel_key)
        if entry is None:
            entry = {"diffs": [], "sample": change, "cities": set()}
            grouped[fuel_key] = entry

        entry["diffs"].append(diff)
        city = str(change.get("city") or "").strip()
        if city:
            entry["cities"].add(city)

    result: dict[str, dict[str, Any]] = {}

    for fuel_key, entry in grouped.items():
        amount = round(float(median(entry["diffs"])), 2)
        if amount == 0:
            continue

        result[fuel_key] = {
            "fuel_key": fuel_key,
            "fuel": entry["sample"].get("fuel"),
            "actual_amount": abs(amount),
            "direction": "increase" if amount > 0 else "decrease",
            "city_count": len(entry["cities"]) or len(entry["diffs"]),
            "sample_change": entry["sample"],
        }

    return result


def realized_tolerance(
    expected_amount: float,
    tolerance_tl: float = DEFAULT_REALIZED_TOLERANCE_TL,
    tolerance_ratio: float = DEFAULT_REALIZED_TOLERANCE_RATIO,
) -> float:
    """Mutlak ve oransal toleranstan büyük olanı döndürür.

    5.20 TL beklenti için tolerans 1.82 TL olur; 0.40 TL beklenti için 0.75 TL.
    """
    return max(float(tolerance_tl), abs(float(expected_amount)) * float(tolerance_ratio))


def find_realized_expectations(
    changes: Iterable[dict[str, Any]] | None,
    expected_signals: Iterable[dict[str, Any]] | None,
    *,
    tolerance_tl: float = DEFAULT_REALIZED_TOLERANCE_TL,
    tolerance_ratio: float = DEFAULT_REALIZED_TOLERANCE_RATIO,
    max_matches: int | None = None,
) -> list[dict[str, Any]]:
    """Gerçekleşen değişimlerle en güncel beklentileri eşleştirir.

    ``expected_signals`` yeni tarihten eskiye sıralı olmalıdır; aynı yakıt için
    ilk (en güncel) beklenti değerlendirilir. Yön ve tutar toleransı tutmuyorsa
    eşleşme üretilmez.
    """
    actual = actual_change_by_fuel(changes)
    if not actual:
        return []

    matches: list[dict[str, Any]] = []
    seen: set[str] = set()

    for signal_entry in expected_signals or []:
        if not isinstance(signal_entry, dict):
            continue

        fuel_key = normalize_fuel_key(signal_entry.get("fuel"))
        if not fuel_key or fuel_key in seen:
            continue

        expected = expected_amount_tl(signal_entry)
        if expected is None:
            continue

        expected_direction = str(signal_entry.get("direction") or "").strip().lower()
        if expected_direction not in {"increase", "decrease"}:
            continue

        actual_entry = actual.get(fuel_key)
        if actual_entry is None or actual_entry["direction"] != expected_direction:
            continue

        expected_abs = abs(float(expected))
        if abs(actual_entry["actual_amount"] - expected_abs) > realized_tolerance(
            expected_abs,
            tolerance_tl,
            tolerance_ratio,
        ):
            continue

        seen.add(fuel_key)
        matches.append(
            {
                "fuel_key": fuel_key,
                "fuel": actual_entry["fuel"] or signal_entry.get("fuel"),
                "direction": expected_direction,
                "expected_amount": round(expected_abs, 2),
                "actual_amount": actual_entry["actual_amount"],
                "city_count": actual_entry["city_count"],
                "signal_date": signal_entry.get("signal_date"),
                "sample_change": actual_entry["sample_change"],
            }
        )

        if max_matches is not None and len(matches) >= max_matches:
            break

    return matches


def realized_by_fuel(matches: Iterable[dict[str, Any]] | None) -> dict[str, dict[str, Any]]:
    """Eşleşmeleri yakıt anahtarına göre sözlüğe çevirir (mesaj üretimi için)."""
    return {
        match["fuel_key"]: match
        for match in matches or []
        if match and match.get("fuel_key")
    }
