"""Validate price_items used for same-day price memory and notifications."""

ALLOWED_MEMORY_FUELS = frozenset({"Benzin", "Motorin", "LPG"})

FUEL_ALIASES = {
    "LPG (Otogaz)": "LPG",
    "Otogaz": "LPG",
}

MAX_MEMORY_AVERAGE_DIFF = 10.0


def normalize_memory_fuel(fuel):
    if fuel is None:
        return None

    name = str(fuel).strip()

    if name in ALLOWED_MEMORY_FUELS:
        return name

    return FUEL_ALIASES.get(name)


def parse_finite_average_diff(value):
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

    return number


def sanitize_price_memory_item(item):
    if not isinstance(item, dict):
        print(f"UYARI: price_items kaydi gecersiz (nesne degil): {item!r}")
        return None

    fuel = normalize_memory_fuel(item.get("fuel"))

    if fuel is None:
        print(f"UYARI: price_items kaydi reddedildi (gecersiz yakit): {item.get('fuel')!r}")
        return None

    average_diff = parse_finite_average_diff(item.get("average_diff"))

    if average_diff is None:
        print(
            "UYARI: price_items kaydi reddedildi (average_diff sayisal degil): "
            f"{item.get('average_diff')!r}"
        )
        return None

    if abs(average_diff) > MAX_MEMORY_AVERAGE_DIFF:
        print(
            "UYARI: price_items kaydi reddedildi (average_diff sinir disi): "
            f"{average_diff}"
        )
        return None

    sanitized = dict(item)
    sanitized["fuel"] = fuel
    sanitized["average_diff"] = average_diff

    return sanitized


def sanitize_price_memory_items(items):
    if not items:
        return []

    sanitized = []

    for item in items:
        clean = sanitize_price_memory_item(item)

        if clean is not None:
            sanitized.append(clean)

    return sanitized
