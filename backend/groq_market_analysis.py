"""Groq market analysis helpers: news prep, context, signal parsing, summaries."""

import re
from collections import Counter
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
MAX_EXTRACTED_AMOUNT_TL = 10.0
DIRECTION_WINDOW_CHARS = 90

FUEL_STEM_PATTERN = re.compile(
    r"\b(?P<stem>benzin|motorin|mazot|otogaz|lpg)\w*\b",
    re.IGNORECASE,
)

FUEL_STEM_TO_NAME = {
    "benzin": "Benzin",
    "motorin": "Motorin",
    "mazot": "Motorin",
    "otogaz": "LPG",
    "lpg": "LPG",
}

SOURCE_DISAGREEMENT_NOTE = "kaynaklar arasında fark var"
MAX_GROQ_SUMMARY_CHARS = 160
NO_CHANGE_SUMMARY = "Değişiklik beklenmiyor."
SUMMARY_ARROW_UP = "↑"
SUMMARY_ARROW_DOWN = "↓"

INCREASE_HINTS = (
    "zam",
    "artis",
    "artış",
    "yuksel",
    "yüksel",
    "zamlandi",
    "zamlandı",
    "yukari",
    "yukarı",
    "artacak",
    "yukselecek",
    "yükseliş",
    "yukselis",
)

DECREASE_HINTS = (
    "indirim",
    "dusus",
    "düşüş",
    "dus",
    "düş",
    "gerile",
    "asagi",
    "aşağı",
    "azal",
    "azalis",
    "azalış",
)

TURKISH_NUMBER_WORDS = {
    "bir": 1,
    "iki": 2,
    "uc": 3,
    "dort": 4,
    "bes": 5,
    "alti": 6,
    "yedi": 7,
    "sekiz": 8,
    "dokuz": 9,
    "on": 10,
}

TURKISH_KURUS_WORDS = {
    "on": 10,
    "yirmi": 20,
    "otuz": 30,
    "kirk": 40,
    "elli": 50,
    "altmis": 60,
    "yetmis": 70,
    "seksen": 80,
    "doksan": 90,
}

RE_NUMERIC_TL = re.compile(
    r"(?:litre\s+basina\s+)?(?P<num>\d{1,2}(?:[.,]\d{1,2})?)\s*(?:tl|₺|lira(?:lik|luk|lık|lığı)?)",
    re.IGNORECASE,
)
RE_LIRA_KURUS_WRITTEN = re.compile(
    r"(?P<lira_word>bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on|\d{1,2})\s+lira\s+"
    r"(?P<kurus_word>elli|on|yirmi|otuz|kirk|bes|alti|yedi|sekiz|dokuz|\d{1,2})\s+kurus(?:luk|lugü|lüğü)?",
    re.IGNORECASE,
)
RE_LIRA_KURUS = re.compile(
    r"(?P<lira>\d{1,2})\s+lira\s+(?P<kurus>\d{1,2})\s+kurus(?:luk|lugü|lüğü)?",
    re.IGNORECASE,
)
RE_KURUS_ONLY = re.compile(
    r"(?P<kurus>\d{1,2})\s+kurus(?:luk|lugü|lüğü)?",
    re.IGNORECASE,
)
RE_BIR_BUCUK_LIRA = re.compile(r"\bbir\s+bucuk\s+lira(?:lik)?\b", re.IGNORECASE)
RE_WRITTEN_LIRA = re.compile(
    r"\b(?P<word>bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)(?:\s+bucuk)?\s+lira(?:lik)?\b",
    re.IGNORECASE,
)
RE_WRITTEN_LIRA_KURUS = re.compile(
    r"\b(?P<lira_word>bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)\s+lira\s+"
    r"(?P<kurus_word>elli|on|yirmi|otuz|kirk|bes|alti|yedi|sekiz|dokuz|\d{1,2})\s+kurus\b",
    re.IGNORECASE,
)


def normalize_extraction_text(value: str) -> str:
    replacements = {
        "İ": "i",
        "I": "i",
        "ı": "i",
        "Ş": "s",
        "ş": "s",
        "Ğ": "g",
        "ğ": "g",
        "Ü": "u",
        "ü": "u",
        "Ö": "o",
        "ö": "o",
        "Ç": "c",
        "ç": "c",
    }
    normalized = str(value or "").lower()

    for source, target in replacements.items():
        normalized = normalized.replace(source, target)

    return normalized


def parse_numeric_token(token: str) -> float | None:
    if not token:
        return None

    try:
        return float(token.replace(",", "."))
    except ValueError:
        return None


def word_to_number(word: str) -> int | None:
    return TURKISH_NUMBER_WORDS.get(normalize_extraction_text(word))


def kurus_word_to_int(word: str) -> int | None:
    normalized = normalize_extraction_text(word)

    if normalized.isdigit():
        return int(normalized)

    return TURKISH_KURUS_WORDS.get(normalized) or TURKISH_NUMBER_WORDS.get(normalized)


def within_amount_limit(amount: float) -> bool:
    return abs(amount) <= MAX_EXTRACTED_AMOUNT_TL and amount != 0


def iter_fuel_mentions(normalized_text: str) -> list[tuple[int, str]]:
    mentions = []

    for match in FUEL_STEM_PATTERN.finditer(normalized_text):
        stem = normalize_extraction_text(match.group("stem"))
        fuel = FUEL_STEM_TO_NAME.get(stem)

        if fuel:
            mentions.append((match.start(), fuel))

    return mentions


def find_fuel_near(normalized_text: str, position: int) -> str | None:
    best_fuel = None
    best_distance = None

    for index, fuel in iter_fuel_mentions(normalized_text):
        distance = abs(index - position)

        if best_distance is None or distance < best_distance:
            best_distance = distance
            best_fuel = fuel

    return best_fuel


def is_decimal_comma(normalized_text: str, comma_index: int) -> bool:
    if comma_index < 0 or comma_index >= len(normalized_text):
        return False

    if normalized_text[comma_index] != ",":
        return False

    left = normalized_text[max(0, comma_index - 3) : comma_index]
    right = normalized_text[comma_index + 1 : comma_index + 4]

    return bool(re.search(r"\d$", left)) and bool(re.search(r"^\d", right))


def _list_comma_left(normalized_text: str, start: int) -> int:
    pos = start

    while pos > 0:
        comma_index = normalized_text.rfind(",", 0, pos)

        if comma_index < 0:
            return -1

        if is_decimal_comma(normalized_text, comma_index):
            pos = comma_index
            continue

        return comma_index

    return -1


def _list_comma_right(normalized_text: str, end: int) -> int:
    pos = end

    while pos < len(normalized_text):
        comma_index = normalized_text.find(",", pos)

        if comma_index < 0:
            return -1

        if is_decimal_comma(normalized_text, comma_index):
            pos = comma_index + 1
            continue

        return comma_index

    return -1


def local_clause_window(normalized_text: str, start: int, end: int) -> tuple[int, int]:
    sentence_left = normalized_text.rfind(". ", 0, start)
    clause_start = sentence_left + 2 if sentence_left >= 0 else 0

    comma_left = _list_comma_left(normalized_text, start)

    if comma_left >= 0 and comma_left + 1 > clause_start:
        clause_start = comma_left + 1

    ise_left = normalized_text.rfind(" ise ", clause_start, start)

    if ise_left >= 0:
        clause_start = max(clause_start, ise_left + len(" ise "))

    comma_right = _list_comma_right(normalized_text, end)
    ise_right = normalized_text.find(" ise ", end)
    right_candidates = [value for value in (comma_right, ise_right) if value != -1]
    clause_end = min(right_candidates) if right_candidates else len(normalized_text)

    sentence_right = normalized_text.find(". ", end)

    if sentence_right != -1 and sentence_right < clause_end:
        clause_end = sentence_right

    return clause_start, clause_end


def list_segment_bounds(normalized_text: str, position: int) -> tuple[int, int]:
    sentence_start = normalized_text.rfind(". ", 0, position)
    seg_start = sentence_start + 2 if sentence_start >= 0 else 0
    sentence_end = normalized_text.find(". ", position)
    seg_limit = sentence_end if sentence_end != -1 else len(normalized_text)

    for index in range(seg_start, seg_limit):
        char = normalized_text[index]

        if char != "," or is_decimal_comma(normalized_text, index):
            continue

        if index >= position:
            return seg_start, index

        seg_start = index + 1

    return seg_start, seg_limit


def find_fuel_for_amount(normalized_text: str, start: int, end: int) -> tuple[str | None, int | None]:
    seg_start, seg_end = list_segment_bounds(normalized_text, start)
    segment_mentions = [
        (index, fuel)
        for index, fuel in iter_fuel_mentions(normalized_text)
        if seg_start <= index < seg_end
    ]

    before = [mention for mention in segment_mentions if mention[0] <= start]

    if before:
        index, fuel = before[-1]
        return fuel, index

    clause_start, clause_end = local_clause_window(normalized_text, start, end)
    clause_mentions = [
        (index, fuel)
        for index, fuel in iter_fuel_mentions(normalized_text)
        if clause_start <= index < clause_end
    ]

    before = [mention for mention in clause_mentions if mention[0] <= start]

    if before:
        index, fuel = before[-1]
        return fuel, index

    after = [mention for mention in clause_mentions if mention[0] >= start]

    if after:
        index, fuel = after[0]
        return fuel, index

    fuel = find_fuel_near(normalized_text, start)
    position = find_fuel_position_near(normalized_text, start)

    return fuel, position


def find_fuel_position_near(normalized_text: str, position: int) -> int | None:
    best_position = None
    best_distance = None

    for index, _fuel in iter_fuel_mentions(normalized_text):
        distance = abs(index - position)

        if best_distance is None or distance < best_distance:
            best_distance = distance
            best_position = index

    return best_position


def find_direction_near(
    normalized_text: str,
    start: int,
    end: int,
    fuel_position: int | None = None,
) -> str:
    anchor = fuel_position if fuel_position is not None else start
    window_start = max(0, anchor - DIRECTION_WINDOW_CHARS)
    window_end = min(len(normalized_text), end + DIRECTION_WINDOW_CHARS)
    window = normalized_text[window_start:window_end]
    immediate_after = normalized_text[end : min(len(normalized_text), end + 28)]
    immediate_before = normalized_text[max(0, start - 28) : start]

    if any(hint in immediate_after for hint in INCREASE_HINTS) and not any(
        hint in immediate_after for hint in DECREASE_HINTS
    ):
        return "increase"

    if any(hint in immediate_after for hint in DECREASE_HINTS) and not any(
        hint in immediate_after for hint in INCREASE_HINTS
    ):
        return "decrease"

    if any(hint in immediate_before for hint in INCREASE_HINTS) and not any(
        hint in immediate_before for hint in DECREASE_HINTS
    ):
        return "increase"

    if any(hint in immediate_before for hint in DECREASE_HINTS) and not any(
        hint in immediate_before for hint in INCREASE_HINTS
    ):
        return "decrease"

    def hint_distance(hint: str) -> int | None:
        index = window.find(hint)

        if index < 0:
            return None

        return abs((window_start + index) - start)

    increase_distances = [dist for hint in INCREASE_HINTS for dist in [hint_distance(hint)] if dist is not None]
    decrease_distances = [dist for hint in DECREASE_HINTS for dist in [hint_distance(hint)] if dist is not None]

    if increase_distances and decrease_distances:
        nearest_increase = min(increase_distances)
        nearest_decrease = min(decrease_distances)

        if nearest_increase < nearest_decrease:
            return "increase"

        if nearest_decrease < nearest_increase:
            return "decrease"

        return "neutral"

    if increase_distances:
        return "increase"

    if decrease_distances:
        return "decrease"

    return "neutral"


def signed_amount_tl(amount_tl: float, direction: str) -> float | None:
    if direction == "increase":
        return round(abs(amount_tl), 2)

    if direction == "decrease":
        return round(-abs(amount_tl), 2)

    return None


def extract_price_amounts(text: str, normalize_text_fn=None) -> list[dict[str, Any]]:
    """Extract fuel-linked TL/litre amounts from a single text block."""
    if not text or not str(text).strip():
        return []

    normalize_text_fn = normalize_text_fn or normalize_extraction_text
    normalized = normalize_text_fn(text)

    findings: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str, float]] = set()
    lira_kurus_spans = [(match.start(), match.end()) for match in RE_LIRA_KURUS.finditer(normalized)]

    def register(amount: float, start: int, end: int) -> None:
        if not within_amount_limit(amount):
            return

        fuel, fuel_position = find_fuel_for_amount(normalized, start, end)

        if fuel is None:
            return

        direction = find_direction_near(normalized, start, end, fuel_position)

        if direction == "neutral":
            return

        amount_tl = round(abs(amount), 2)
        key = (fuel, direction, amount_tl)

        if key in seen_keys:
            return

        seen_keys.add(key)
        findings.append(
            {
                "fuel": fuel,
                "direction": direction,
                "amount_tl": amount_tl,
                "signed_amount_tl": signed_amount_tl(amount_tl, direction),
            }
        )

    def overlaps_lira_kurus_span(start: int, end: int) -> bool:
        return any(
            (start >= span_start and start < span_end) or (end > span_start and end <= span_end)
            for span_start, span_end in lira_kurus_spans
        )

    for match in RE_NUMERIC_TL.finditer(normalized):
        if overlaps_lira_kurus_span(match.start(), match.end()):
            continue

        amount = parse_numeric_token(match.group("num"))

        if amount is not None:
            register(amount, match.start(), match.end())

    for match in RE_LIRA_KURUS.finditer(normalized):
        lira = parse_numeric_token(match.group("lira"))
        kurus = parse_numeric_token(match.group("kurus"))

        if lira is not None and kurus is not None:
            register(lira + kurus / 100.0, match.start(), match.end())

    for match in RE_LIRA_KURUS_WRITTEN.finditer(normalized):
        lira_word = match.group("lira_word")
        lira = parse_numeric_token(lira_word) if lira_word.isdigit() else word_to_number(lira_word)
        kurus_value = kurus_word_to_int(match.group("kurus_word"))

        if lira is not None and kurus_value is not None:
            register(lira + kurus_value / 100.0, match.start(), match.end())

    for match in RE_KURUS_ONLY.finditer(normalized):
        if any(start <= match.start() and match.end() <= end for start, end in lira_kurus_spans):
            continue

        kurus = parse_numeric_token(match.group("kurus"))

        if kurus is not None:
            register(kurus / 100.0, match.start(), match.end())

    for match in RE_BIR_BUCUK_LIRA.finditer(normalized):
        register(1.5, match.start(), match.end())

    for match in RE_WRITTEN_LIRA_KURUS.finditer(normalized):
        lira_word = word_to_number(match.group("lira_word"))
        kurus_value = kurus_word_to_int(match.group("kurus_word"))

        if lira_word is not None and kurus_value is not None:
            register(lira_word + kurus_value / 100.0, match.start(), match.end())

    for match in RE_WRITTEN_LIRA.finditer(normalized):
        if RE_WRITTEN_LIRA_KURUS.search(normalized, match.start(), match.end()):
            continue

        if RE_BIR_BUCUK_LIRA.search(normalized, match.start(), match.end()):
            continue

        word = match.group("word")
        base = word_to_number(word)
        snippet = normalized[match.start() : match.end()]

        if base is None:
            continue

        amount = float(base)

        if "bucuk" in snippet and word == "bir":
            amount = 1.5
        elif "bucuk" in snippet:
            amount = base + 0.5

        register(amount, match.start(), match.end())

    return findings


def extract_price_amounts_from_fields(
    title: str | None,
    summary: str | None,
    description: str | None,
    normalize_text_fn,
    article_text: str | None = None,
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[tuple[str, str, float]] = set()

    for field in (title, summary, description, article_text):
        if not field:
            continue

        for entry in extract_price_amounts(field, normalize_text_fn):
            key = (entry["fuel"], entry["direction"], entry["amount_tl"])

            if key in seen:
                continue

            seen.add(key)
            merged.append(entry)

    return merged


def explain_empty_extracted_amounts(
    title: str | None,
    summary: str | None,
    description: str | None,
    normalize_text_fn,
    article_text: str | None = None,
) -> list[str]:
    reasons: list[str] = []
    fields = {
        "title": title,
        "summary": summary,
        "description": description,
        "article_text": article_text,
    }

    for field_name, field_value in fields.items():
        if not field_value or not str(field_value).strip():
            reasons.append(f"{field_name}:bos")
            continue

        normalized = normalize_text_fn(str(field_value))
        findings = extract_price_amounts(field_value, normalize_text_fn)

        if findings:
            continue

        if not iter_fuel_mentions(normalized):
            reasons.append(f"{field_name}:yakit_eslesmesi_yok")
            continue

        if not (
            RE_NUMERIC_TL.search(normalized)
            or RE_LIRA_KURUS.search(normalized)
            or RE_LIRA_KURUS_WRITTEN.search(normalized)
            or RE_KURUS_ONLY.search(normalized)
            or RE_WRITTEN_LIRA.search(normalized)
            or RE_WRITTEN_LIRA_KURUS.search(normalized)
        ):
            reasons.append(f"{field_name}:tutar_kaliplari_yok")
            continue

        reasons.append(f"{field_name}:tutar_yon_eslesmedi")

    return reasons


def build_haberlerde_gecen_tutarlar(news_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sections = []

    for item in news_items:
        amounts = item.get("extracted_amounts") or []

        if not amounts:
            continue

        sections.append(
            {
                "headline": item.get("title") or "",
                "amounts": [
                    {
                        "fuel": amount["fuel"],
                        "direction": amount["direction"],
                        "amount_tl": amount["amount_tl"],
                    }
                    for amount in amounts
                ],
            }
        )

    return sections


def flatten_news_amount_extractions(news_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    flattened = []

    for item in news_items:
        headline = item.get("title") or ""

        for amount in item.get("extracted_amounts") or []:
            flattened.append({**amount, "headline": headline})

    return flattened


def aggregate_news_amount_extractions(
    news_items: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], bool]:
    buckets: dict[tuple[str, str], list[float]] = {}

    for item in news_items:
        for entry in item.get("extracted_amounts") or []:
            fuel = entry.get("fuel")
            direction = entry.get("direction")
            amount_tl = entry.get("amount_tl")

            if fuel is None or direction is None or amount_tl is None:
                continue

            key = (fuel, direction)
            buckets.setdefault(key, []).append(round(float(amount_tl), 2))

    aggregated: list[dict[str, Any]] = []
    any_disagreement = False

    for (fuel, direction), amounts in buckets.items():
        counter = Counter(amounts)
        majority_amount, _votes = counter.most_common(1)[0]
        source_disagreement = len(counter) > 1

        if source_disagreement:
            any_disagreement = True

        aggregated.append(
            {
                "fuel": fuel,
                "direction": direction,
                "amount_tl": majority_amount,
                "signed_amount_tl": signed_amount_tl(majority_amount, direction),
                "source_disagreement": source_disagreement,
            }
        )

    return aggregated, any_disagreement


def reconcile_expected_amount(
    fuel: str,
    direction: str,
    groq_amount: Any,
    news_extractions: list[dict[str, Any]],
) -> float | None:
    if direction not in {"increase", "decrease"}:
        return None

    candidates = [
        entry
        for entry in news_extractions
        if entry.get("fuel") == fuel and entry.get("direction") == direction
    ]

    if not candidates:
        return None

    allowed_signed = {
        round(float(entry["signed_amount_tl"]), 2)
        for entry in candidates
        if entry.get("signed_amount_tl") is not None
    }

    parsed_groq = parse_expected_amount_tl(groq_amount)

    if parsed_groq is not None:
        groq_signed = parsed_groq

        if direction == "increase" and groq_signed < 0:
            groq_signed = abs(groq_signed)
        elif direction == "decrease" and groq_signed > 0:
            groq_signed = -groq_signed

        groq_signed = round(groq_signed, 2)

        if groq_signed in allowed_signed:
            return groq_signed

        for entry in candidates:
            if round(float(entry["amount_tl"]), 2) == round(abs(groq_signed), 2):
                return round(float(entry["signed_amount_tl"]), 2)

        return None

    if len(allowed_signed) == 1:
        return next(iter(allowed_signed))

    majority_candidates = [
        entry for entry in candidates if entry.get("amount_tl") is not None
    ]

    if majority_candidates:
        amounts = [round(float(entry["amount_tl"]), 2) for entry in majority_candidates]
        majority_amount = Counter(amounts).most_common(1)[0][0]

        for entry in majority_candidates:
            if round(float(entry["amount_tl"]), 2) == majority_amount:
                return round(float(entry["signed_amount_tl"]), 2)

    return None


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


def compute_bu_gece_effective_at(
    reference: datetime,
    timing: str | None = None,
    normalized_title: str = "",
) -> datetime | None:
    """Istanbul midnight when a 'bu gece' pump change is expected to apply."""
    timing_value = (timing or "").lower()

    if not title_implies_bu_gece(normalized_title) and "bu gece" not in timing_value:
        return None

    local = reference.astimezone(reference.tzinfo)
    target_date = local.date()

    if local.hour >= 18:
        target_date = local.date() + timedelta(days=1)

    return datetime(target_date.year, target_date.month, target_date.day, tzinfo=local.tzinfo)


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
    enriched["extracted_amounts"] = extract_price_amounts_from_fields(
        title,
        item.get("summary"),
        item.get("description"),
        normalize_text_fn,
        item.get("article_text"),
    )

    if not enriched["extracted_amounts"]:
        reasons = explain_empty_extracted_amounts(
            title,
            item.get("summary"),
            item.get("description"),
            normalize_text_fn,
            item.get("article_text"),
        )
        enriched["amount_extraction_notes"] = reasons
        print(
            "Haber tutar cikarimi bos: "
            f"kaynak={item.get('source')!r} baslik={title[:80]!r} nedenler={','.join(reasons)}"
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
    news_extractions: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    news_extractions = news_extractions or []
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
        current_price = current_prices.get(fuel)

        if direction not in {"increase", "decrease"}:
            direction = "neutral"

        amount = None

        if direction != "neutral":
            amount = reconcile_expected_amount(
                fuel,
                direction,
                entry.get("expected_amount_tl"),
                news_extractions,
            )

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


def active_directional_signals(signals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        signal
        for signal in signals
        if signal.get("fuel") in ALLOWED_SIGNAL_FUELS
        and signal.get("direction") in {"increase", "decrease"}
    ]


def build_fallback_signal_summary(signals: list[dict[str, Any]]) -> str:
    active = active_directional_signals(signals)

    if not active:
        return NO_CHANGE_SUMMARY

    parts = []

    for fuel in ("Motorin", "Benzin", "LPG"):
        signal = next((entry for entry in signals if entry.get("fuel") == fuel), None)

        if not signal or signal.get("direction") not in {"increase", "decrease"}:
            continue

        arrow = SUMMARY_ARROW_UP if signal["direction"] == "increase" else SUMMARY_ARROW_DOWN
        amount = signal.get("expected_amount_tl")

        if amount is None:
            parts.append(f"{fuel} {arrow} (tutar belirsiz)")
        else:
            parts.append(f"{fuel} {arrow} {format_tl_amount(abs(float(amount)))} TL")

    return "; ".join(parts) if parts else NO_CHANGE_SUMMARY


def _summary_part_for_fuel(summary: str, fuel: str) -> str | None:
    for part in summary.split(";"):
        cleaned = part.strip()

        if fuel.lower() in cleaned.lower():
            return cleaned

    return None


def _parse_amount_from_summary_part(part: str) -> float | None:
    match = re.search(r"(\d{1,2}(?:[.,]\d{1,2})?)\s*tl", part.lower())

    if not match:
        return None

    return parse_numeric_token(match.group(1))


def validate_groq_summary(summary: str, signals: list[dict[str, Any]]) -> bool:
    if not summary or len(summary.strip()) > MAX_GROQ_SUMMARY_CHARS:
        return False

    text = summary.strip()
    active = active_directional_signals(signals)

    if not active:
        return text == NO_CHANGE_SUMMARY

    if text == NO_CHANGE_SUMMARY:
        return False

    for signal in active:
        fuel = signal["fuel"]
        part = _summary_part_for_fuel(text, fuel)

        if not part:
            return False

        expected_arrow = SUMMARY_ARROW_UP if signal["direction"] == "increase" else SUMMARY_ARROW_DOWN

        if expected_arrow not in part:
            return False

        amount = signal.get("expected_amount_tl")

        if amount is None:
            if "(tutar belirsiz)" not in part.lower():
                return False
            continue

        parsed_amount = _parse_amount_from_summary_part(part)

        if parsed_amount is None:
            return False

        if round(parsed_amount, 2) != round(abs(float(amount)), 2):
            return False

    return True


def resolve_market_summary(groq_summary: str | None, signals: list[dict[str, Any]]) -> str:
    if groq_summary and validate_groq_summary(groq_summary, signals):
        return groq_summary.strip()

    return build_fallback_signal_summary(signals)


def fuel_name_for_summary(fuel: str, capitalize: bool) -> str:
    if fuel == "LPG":
        return "LPG"

    label = fuel.lower()

    if capitalize:
        return label[0].upper() + label[1:]

    return label


def fuel_dative_label(fuel: str) -> str:
    if fuel == "Motorin":
        return "Motorine"

    if fuel == "Benzin":
        return "Benzine"

    return "LPG'ye"


def build_summary_clause(signal: dict[str, Any], capitalize_fuel: bool) -> str | None:
    fuel = signal.get("fuel")
    direction = signal.get("direction")

    if fuel not in ALLOWED_SIGNAL_FUELS or direction not in {"increase", "decrease"}:
        return None

    verb = "artacak" if direction == "increase" else "düşecek"
    amount = signal.get("expected_amount_tl")

    if amount is not None:
        magnitude = abs(float(amount))
        fuel_label = fuel_name_for_summary(fuel, capitalize_fuel)

        if magnitude >= 1:
            return f"{fuel_label} {format_tl_amount(magnitude)} lira {verb}"

        kurus = int(round(magnitude * 100))
        return f"{fuel_label} {kurus} kuruş {verb}"

    dative = fuel_dative_label(fuel)

    if direction == "increase":
        return f"{dative} zam bekleniyor"

    return f"{dative} indirim bekleniyor"


def build_deterministic_market_summary(signals: list[dict[str, Any]]) -> str:
    clauses = []

    for fuel in ("Motorin", "Benzin", "LPG"):
        signal = next((entry for entry in signals if entry.get("fuel") == fuel), None)

        if not signal:
            continue

        clause = build_summary_clause(signal, capitalize_fuel=not clauses)

        if clause:
            clauses.append(clause)

    if not clauses:
        return "Fiyat değişikliği beklenmiyor."

    summary = ", ".join(clauses)
    return f"{summary[0].upper()}{summary[1:]}."


def derive_overall_direction(signals: list[dict[str, Any]]) -> str:
    active_directions = {
        signal.get("direction")
        for signal in signals
        if signal.get("direction") in {"increase", "decrease"}
        and signal.get("expected_amount_tl") is not None
    }

    if not active_directions:
        return "neutral"

    if "increase" in active_directions and "decrease" in active_directions:
        return "neutral"

    scored = [
        signal
        for signal in signals
        if signal.get("direction") in active_directions
        and signal.get("expected_amount_tl") is not None
    ]
    scored.sort(key=lambda item: abs(float(item.get("expected_amount_tl") or 0)), reverse=True)
    return scored[0]["direction"]


def build_mobile_fuel_signals(
    parsed_signals: list[dict[str, Any]],
    confidence: str,
    score: int,
    timing: str | None = None,
    reference_time: datetime | None = None,
) -> list[dict[str, Any]]:
    timing_value = timing or DEFAULT_TIMING
    mobile_signals = []
    reference_time = reference_time or datetime.now()

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
            fuel_timing = (
                signal.get("timing")
                or (timing_value if timing_value != DEFAULT_TIMING else "Bu gece yarısı")
            )
            fuel_amount = amount if amount is not None else 0.0

        effective_at = None
        effective_dt = compute_bu_gece_effective_at(
            reference_time,
            timing=fuel_timing if direction != "neutral" else None,
            normalized_title="",
        )

        if effective_dt is not None:
            effective_at = effective_dt.isoformat()

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
                "effective_at": effective_at,
            }
        )

    return mobile_signals
