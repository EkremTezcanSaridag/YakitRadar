import csv
import io
import json
import os
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from xml.etree import ElementTree

import requests
from dotenv import load_dotenv

from http_client import SCRAPER_REQUEST_TIMEOUT, make_request_with_retry
from price_memory_validation import sanitize_price_memory_items
from groq_market_analysis import (
    DEFAULT_CONFIDENCE,
    DEFAULT_TIMING,
    SOURCE_DISAGREEMENT_NOTE,
    aggregate_news_amount_extractions,
    build_haberlerde_gecen_tutarlar,
    build_macro_snapshot,
    build_mobile_fuel_signals,
    compute_pump_averages,
    derive_overall_direction,
    enrich_news_item,
    format_gecmis_trend,
    parse_groq_fuel_signals,
    resolve_market_summary,
    strip_news_title_source_suffix,
)

load_dotenv()


def resolve_istanbul_timezone():
    try:
        return ZoneInfo("Europe/Istanbul")
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=3))


ISTANBUL_TZ = resolve_istanbul_timezone()

BRENT_SOURCES = [
    {
        "name": "DataHub Brent Daily",
        "url": "https://datahub.io/core/oil-prices/r/brent-daily.csv",
        "date_field": "Date",
        "price_fields": ["Price"],
    },
    {
        "name": "FRED DCOILBRENTEU",
        "url": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU",
        "date_field": "observation_date",
        "price_fields": ["DCOILBRENTEU", "Price"],
    },
]

FUEL_SIGNAL_FACTORS = {
    "Benzin": 1.0,
    "Motorin": 1.12,
    "LPG": 0.72,
}

NEWS_FEEDS = [
    {
        "name": "Akaryakit Haberleri",
        "url": "https://news.google.com/rss/search?q=akaryak%C4%B1t%20zam%20indirim%20motorin%20benzin%20when%3A2d&hl=tr&gl=TR&ceid=TR:tr",
    },
    {
        "name": "Motorin Haberleri",
        "url": "https://news.google.com/rss/search?q=motorine%20indirim%20OR%20zam%20when%3A2d&hl=tr&gl=TR&ceid=TR:tr",
    },
    {
        "name": "Benzin Haberleri",
        "url": "https://news.google.com/rss/search?q=benzine%20indirim%20OR%20zam%20when%3A2d&hl=tr&gl=TR&ceid=TR:tr",
    },
    {
        "name": "Brent Petrol Haberleri",
        "url": "https://news.google.com/rss/search?q=brent%20petrol%20dolar%20akaryak%C4%B1t%20when%3A2d&hl=tr&gl=TR&ceid=TR:tr",
    },
]
NEWS_MAX_AGE_HOURS = int(os.getenv("NEWS_MAX_AGE_HOURS", "24"))
NEWS_PRICE_PATTERN = re.compile(r"(?<!\d)(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:(?:TL|lira)\b|₺)", re.IGNORECASE)
NEWS_BLOCKED_SOURCES = {
    "instagram.com",
    "facebook.com",
    "x.com",
    "twitter.com",
    "youtube.com",
}
NEWS_BLOCKED_KEYWORDS = [
    "arac muayene",
    "araç muayene",
    "muayene ucreti",
    "muayene ücreti",
    "trafik sigortasi",
    "trafik sigortası",
    "kasko",
    "mtv",
    "motorlu tasitlar",
    "motorlu taşıtlar",
]
NEWS_STRONG_ACTION_KEYWORDS = [
    "bu gece",
    "bu gece yarisi",
    "bu gece yarısı",
    "yarindan itibaren",
    "yarından itibaren",
    "gece yarisindan itibaren",
    "gece yarısından itibaren",
]

NEWS_INCREASE_KEYWORDS = [
    "artis",
    "artış",
    "zam",
    "zamlandi",
    "zamlandı",
    "yuksel",
    "yüksel",
    "yukari",
    "yukarı",
    "gerilim",
    "arz",
    "kesinti",
]
NEWS_DECREASE_KEYWORDS = [
    "dus",
    "düş",
    "indirim",
    "gerile",
    "asagi",
    "aşağı",
    "bolluk",
    "ateskes",
    "ateşkes",
]
NEWS_ACTION_KEYWORDS = ["geliyor", "gelecek", "bekleniyor", "ongoruluyor", "öngörülüyor", "gundemde", "gündemde"]
NEWS_ALREADY_APPLIED_KEYWORDS = [
    "geldi",
    "yansidi",
    "yansıdı",
    "degisti",
    "değişti",
    "uygulandi",
    "uygulandı",
    "yapildi",
    "yapıldı",
    "sonrasi",
    "sonrası",
]
NEWS_QUESTION_KEYWORDS = [
    "var mi",
    "var mı",
    "mi geldi",
    "mı geldi",
    "ne kadar",
    "kac tl",
    "kaç tl",
    "zam mi",
    "zam mı",
    "geliyor mu",
    "olacak mi",
    "olacak mı",
    "yapilacak mi",
    "yapılacak mı",
    "dustu mu",
    "düştü mü",
]


def parse_float(value):
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return float(value)

    normalized = str(value).strip().replace(",", ".")

    if not normalized or normalized == ".":
        return None

    try:
        return float(normalized)
    except ValueError:
        return None


def parse_date(value):
    return datetime.strptime(value.strip(), "%Y-%m-%d").date()


def percent_change(current, previous):
    if previous in (None, 0) or current is None:
        return 0

    return round(((current - previous) / previous) * 100, 2)


def format_percent(value):
    return f"{value:+.2f}%"


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def safe_history_value(records, offset, field):
    if not records:
        return None

    index = max(0, len(records) - 1 - offset)

    return records[index].get(field)


def multiply_values(first, second):
    if first is None or second is None:
        raise RuntimeError("Piyasa sinyali icin yeterli gecmis veri yok")

    return first * second


def fetch_csv_text(url):
    try:
        response = make_request_with_retry(url)
        return response.text
    except Exception as e:
        print(f"HATA: CSV verisi cekilemedi ({url}): {e}")
        raise


def fetch_brent_history(limit=12):
    last_error = None

    for source in BRENT_SOURCES:
        try:
            content = fetch_csv_text(source["url"])
            reader = csv.DictReader(io.StringIO(content))
            records = []

            for row in reader:
                date_value = row.get(source["date_field"]) or row.get("Date")
                price = None

                for field in source["price_fields"]:
                    price = parse_float(row.get(field))

                    if price is not None:
                        break

                if not date_value or price is None:
                    continue

                records.append(
                    {
                        "date": parse_date(date_value),
                        "price": price,
                        "source": source["name"],
                        "source_url": source["url"],
                    }
                )

            if records:
                return sorted(records, key=lambda item: item["date"])[-limit:]
        except Exception as error:
            last_error = error

    raise RuntimeError(f"Brent verisi alinamadi: {last_error}")


def tcmb_url_for_date(day):
    today = datetime.now(ISTANBUL_TZ).date()

    if day == today:
        return "https://www.tcmb.gov.tr/kurlar/today.xml"

    return f"https://www.tcmb.gov.tr/kurlar/{day:%Y%m}/{day:%d%m%Y}.xml"


def fetch_usd_try_for_date(day):
    try:
        response = make_request_with_retry(tcmb_url_for_date(day))
    except Exception as e:
        print(f"HATA: TCMB kur verisi cekilemedi ({day}): {e}")
        raise

    root = ElementTree.fromstring(response.content)
    usd_node = root.find("./Currency[@CurrencyCode='USD']")

    if usd_node is None:
        return None

    rate = parse_float(usd_node.findtext("ForexSelling")) or parse_float(usd_node.findtext("ForexBuying"))

    if rate is None:
        return None

    return {
        "date": day,
        "rate": rate,
        "source": "TCMB",
        "source_url": "https://www.tcmb.gov.tr/kurlar/today.xml",
    }


def get_supabase_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

    if not url or not key:
        return None

    try:
        from supabase import create_client

        return create_client(url, key)
    except Exception as error:
        print(f"Supabase istemcisi olusturulamadi: {error}")
        return None


def fetch_pump_price_rows():
    client = get_supabase_client()

    if not client:
        return []

    try:
        result = client.table("fiyatlar").select("il, benzin_95, motorin, lpg").execute()
        return result.data or []
    except Exception as error:
        print(f"Pompa fiyatlari okunamadi: {error}")
        return []


def fetch_gecmis_rows(limit=7):
    client = get_supabase_client()

    if not client:
        return []

    try:
        result = (
            client.table("gecmis")
            .select(
                "tarih, benzin_95, motorin, lpg, benzin_degisim, motorin_degisim, lpg_degisim"
            )
            .order("tarih", desc=True)
            .limit(limit)
            .execute()
        )
        rows = result.data or []
        return list(reversed(rows))
    except Exception as error:
        print(f"Gecmis fiyatlari okunamadi: {error}")
        return []


def serialize_news_for_groq(news_items):
    serialized = []

    for item in news_items:
        entry = {key: value for key, value in item.items() if key != "published_at_parsed"}
        serialized.append(entry)

    return serialized


def fetch_usd_try_history(limit=12):
    records = []
    today = datetime.now(ISTANBUL_TZ).date()

    for offset in range(0, 32):
        day = today - timedelta(days=offset)

        try:
            record = fetch_usd_try_for_date(day)
        except Exception:
            continue

        if record:
            records.append(record)

        if len(records) >= limit:
            break

    if not records:
        print("UYARI: TCMB USD/TRY verisi alinamadi, varsayilan referans kur kaydi olusturuldu.")
        records = [
            {
                "date": today,
                "rate": 34.50,
                "source": "TCMB Fallback",
                "source_url": "https://www.tcmb.gov.tr/kurlar/today.xml",
            }
        ]

    return sorted(records, key=lambda item: item["date"])


def normalize_text(value):
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


def parse_rss_date(value):
    if not value:
        return None

    try:
        parsed = parsedate_to_datetime(value)

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        return parsed.astimezone(ISTANBUL_TZ)
    except Exception:
        return None


def is_blocked_news_source(source):
    normalized = normalize_text(source)

    return any(blocked in normalized for blocked in NEWS_BLOCKED_SOURCES)


def is_recent_news_item(published_at, max_age_hours=NEWS_MAX_AGE_HOURS):
    if published_at is None:
        return False

    cutoff = datetime.now(ISTANBUL_TZ) - timedelta(hours=max_age_hours)

    return published_at >= cutoff


NEWS_PRICE_PATTERN = re.compile(
    r"(?<!\d)(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:(?:TL|lira|liralık|TL'lik|TLlik)\b|₺)",
    re.IGNORECASE,
)


def clean_news_text(value):
    decoded = unescape(value or "")
    without_tags = re.sub(r"<[^>]+>", " ", decoded)

    return re.sub(r"\s+", " ", without_tags).strip()


def extract_news_price_mentions(*values):
    mentions = []
    seen = set()

    for value in values:
        text = clean_news_text(value)

        for match in NEWS_PRICE_PATTERN.finditer(text):
            raw_num = match.group(1).replace(".", ",")
            try:
                num_val = float(raw_num.replace(",", "."))
                amount_str = f"{num_val:.2f}".replace(".", ",")
            except ValueError:
                amount_str = raw_num

            context_start = max(0, match.start() - 40)
            context_end = min(len(text), match.end() + 40)
            context = text[context_start:context_end]
            context_lower = context.lower()

            is_increase = any(k in context_lower for k in ["zam", "artış", "artis", "yüksel", "yuksel", "zamlandı"])
            is_decrease = any(k in context_lower for k in ["indirim", "düşüş", "dusus", "gerile"])

            if is_increase and not is_decrease:
                display = f"+{amount_str} TL Zam"
            elif is_decrease and not is_increase:
                display = f"-{amount_str} TL İndirim"
            else:
                display = f"{amount_str} TL"

            key = (display, context_lower)

            if key in seen:
                continue

            seen.add(key)
            mentions.append({"display": display, "context": context.strip(" -:;,.\\")})

            if len(mentions) >= 5:
                return mentions

    return mentions


def fetch_news_items(limit=8):
    items = []
    seen_titles = set()

    for feed in NEWS_FEEDS:
        try:
            response = make_request_with_retry(
                feed["url"],
                headers={
                    "User-Agent": "YakitRadar/1.0",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                }
            )
            root = ElementTree.fromstring(response.content)

            for node in root.findall("./channel/item"):
                title = (node.findtext("title") or "").strip()
                description = node.findtext("description") or ""

                if not title:
                    continue

                title = strip_news_title_source_suffix(title)
                normalized_title = normalize_text(title)

                if normalized_title in seen_titles:
                    continue

                if any(blocked in normalized_title for blocked in NEWS_BLOCKED_KEYWORDS):
                    continue

                source = node.findtext("source") or feed["name"]
                published_at = parse_rss_date(node.findtext("pubDate"))

                clean_source = source.strip()

                if is_blocked_news_source(clean_source) or not is_recent_news_item(published_at):
                    continue

                clean_description = clean_news_text(description)

                seen_titles.add(normalized_title)
                items.append(
                    {
                        "title": title,
                        "source": clean_source,
                        "url": (node.findtext("link") or "").strip(),
                        "published_at": published_at.isoformat() if published_at else None,
                        "published_at_parsed": published_at,
                        "summary": clean_description or None,
                        "description": clean_description or None,
                        "price_mentions": extract_news_price_mentions(title, description),
                    }
                )
        except Exception as error:
            print(f"Haber akisi okunamadi ({feed['name']}): {error}")

    items.sort(key=lambda item: item.get("published_at") or "", reverse=True)
    return items[:limit]


def score_news_items(news_items):
    if not news_items:
        return {
            "score": 0,
            "direction": "neutral",
            "summary": "Son gunlerde filtreye uyan guvenilir haber basligi bulunamadi; haber etkisi notr kabul edildi.",
        }

    score = 0
    matched = []
    strong_direction = None

    for item in news_items[:8]:
        title = item["title"]
        normalized = normalize_text(title)
        increase_hits = sum(1 for keyword in NEWS_INCREASE_KEYWORDS if normalize_text(keyword) in normalized)
        decrease_hits = sum(1 for keyword in NEWS_DECREASE_KEYWORDS if normalize_text(keyword) in normalized)
        has_action = any(normalize_text(keyword) in normalized for keyword in NEWS_ACTION_KEYWORDS)
        has_strong_action = any(normalize_text(keyword) in normalized for keyword in NEWS_STRONG_ACTION_KEYWORDS)
        is_question = "?" in title or any(normalize_text(keyword) in normalized for keyword in NEWS_QUESTION_KEYWORDS)
        item_score = 0

        has_already_applied = item.get("bu_gece_already_applied") or any(
            normalize_text(keyword) in normalized for keyword in NEWS_ALREADY_APPLIED_KEYWORDS
        )

        if not is_question:
            if has_already_applied and not (has_strong_action or has_action):
                item_score = 0
            elif increase_hits and has_strong_action:
                item_score += 34
                strong_direction = "increase"
            elif increase_hits and has_action:
                item_score += 22
                strong_direction = "increase"
            elif increase_hits:
                item_score += 5
            elif decrease_hits and has_strong_action:
                item_score -= 34
                strong_direction = "decrease"
            elif decrease_hits and has_action:
                item_score -= 22
                strong_direction = "decrease"
            elif decrease_hits:
                item_score -= 5
        else:
            # Soru veya spekülasyon başlıkları güçlü yön veya teyitli skor oluşturamaz
            item_score = 0

        item_score = clamp(item_score, -32, 32)

        if item_score:
            matched.append(title)

        score += item_score

    score = clamp(score, -90, 90)

    if score >= 12:
        direction = "increase"
        summary = "Son haber basliklari akaryakit tarafinda yukari yonlu riskleri one cikariyor."
    elif score <= -12:
        direction = "decrease"
        summary = "Son haber basliklari akaryakit tarafinda indirim veya gevseme ihtimalini one cikariyor."
    else:
        direction = "neutral"
        summary = "Son haber basliklari tek yonlu guclu bir baski gostermiyor."

    return {
        "score": score,
        "direction": direction,
        "summary": summary,
        "matched_titles": matched[:3],
        "strong_direction": strong_direction,
    }


def summarize_price_changes(price_changes):
    if not price_changes:
        return {
            "score": 0,
            "direction": "neutral",
            "summary": "Bugun kayda deger pompa fiyat degisimi algilanmadi.",
            "items": [],
        }

    grouped = {}

    for change in price_changes:
        fuel = change.get("fuel", "Yakit")
        grouped.setdefault(fuel, []).append(change)

    items = []
    signed_score = 0

    for fuel, changes in grouped.items():
        diffs = [float(change.get("diff") or 0) for change in changes]
        average_diff = round(sum(diffs) / len(diffs), 2)
        direction = "increase" if average_diff > 0 else "decrease" if average_diff < 0 else "neutral"
        fuel_score = clamp(round(abs(average_diff) * 45) + min(20, len(changes) // 8), 0, 45)

        if direction == "increase":
            signed_score += fuel_score
        elif direction == "decrease":
            signed_score -= fuel_score

        items.append(
            {
                "fuel": fuel,
                "direction": direction,
                "average_diff": average_diff,
                "city_count": len(changes),
                "score": fuel_score,
            }
        )

    signed_score = clamp(signed_score, -95, 95)

    if signed_score >= 35:
        direction = "increase"
        summary = "Guncel cekilen fiyatlarda zam etkisi dogrudan algilandi."
    elif signed_score <= -35:
        direction = "decrease"
        summary = "Guncel cekilen fiyatlarda indirim etkisi dogrudan algilandi."
    else:
        direction = "neutral"
        summary = "Guncel fiyat degisimleri tek basina guclu yon olusturmadi."

    return {
        "score": signed_score,
        "direction": direction,
        "summary": summary,
        "items": sorted(items, key=lambda item: abs(item["score"]), reverse=True),
    }


def merge_price_memory(current_analysis, previous_price_memory=None):
    previous_price_memory = previous_price_memory or {}

    if current_analysis["score"] != 0:
        return {
            **current_analysis,
            "items": sanitize_price_memory_items(current_analysis.get("items", [])),
            "memory_source": "current_run",
            "remembered_at": datetime.now(ISTANBUL_TZ).isoformat(),
        }

    previous_score = int(previous_price_memory.get("score") or 0)

    if previous_score == 0:
        return {
            **current_analysis,
            "memory_source": "none",
            "remembered_at": None,
        }

    remembered_at = previous_price_memory.get("remembered_at")
    summary = previous_price_memory.get("summary") or "Bugun daha once yakalanan pompa fiyat degisimi analizde korunuyor."

    return {
        "score": previous_score,
        "direction": previous_price_memory.get("direction", "neutral"),
        "summary": summary,
        "items": sanitize_price_memory_items(previous_price_memory.get("items", [])),
        "memory_source": "same_day_memory",
        "remembered_at": remembered_at,
    }


def resolve_direction(index_change_3d, index_change_7d):
    decisive_change = index_change_3d if abs(index_change_3d) >= 2.5 else index_change_7d

    if decisive_change >= 2.5:
        return "increase"

    if decisive_change <= -2.5:
        return "decrease"

    return "neutral"


def resolve_confidence(index_change_3d, index_change_7d):
    pressure = max(abs(index_change_3d), abs(index_change_7d))

    if pressure >= 5:
        return "high"

    if pressure >= 2.5:
        return "medium"

    return "low"


def resolve_combined_direction(market_score, news_score, price_score=0):
    combined = market_score + news_score + price_score

    if price_score >= 55:
        return "increase"

    if price_score <= -55:
        return "decrease"

    if news_score >= 55:
        return "increase"

    if news_score <= -55:
        return "decrease"

    if combined >= 30:
        return "increase"

    if combined <= -30:
        return "decrease"

    return "neutral"


def resolve_combined_confidence(combined_pressure, market_pressure, news_pressure, price_pressure=0):
    if price_pressure >= 55:
        return "high"

    if combined_pressure >= 58 or (market_pressure >= 50 and news_pressure >= 18):
        return "high"

    if combined_pressure >= 30:
        return "medium"

    return "low"


def resolve_news_confidence(news_score):
    pressure = abs(news_score)

    if pressure >= 60:
        return "high"

    if pressure >= 30:
        return "medium"

    return "low"


def direction_label(direction):
    if direction == "increase":
        return "artis baskisi"

    if direction == "decrease":
        return "indirim baskisi"

    return "notr"


def build_fuel_signals(direction, confidence, score, target_fuel=None, expected_amount=None, timing=None):
    signals = []

    for fuel, factor in FUEL_SIGNAL_FACTORS.items():
        is_target = target_fuel and (target_fuel.lower() in fuel.lower() or fuel.lower() in target_fuel.lower())
        is_all = not target_fuel or target_fuel in ["Genel", "Hepsi"]

        if direction != "neutral" and (is_target or is_all):
            fuel_direction = direction
            fuel_score = max(score, 85) if is_target else min(100, round(score * factor))
            fuel_confidence = confidence
            fuel_amount = expected_amount
            fuel_timing = timing or "Bu gece yarısı"
        else:
            fuel_direction = "neutral"
            fuel_score = 0
            fuel_confidence = "high"
            fuel_amount = 0.0
            fuel_timing = "Gündemde değişim yok"

        if fuel == "LPG" and fuel_direction != "neutral" and fuel_score < 42:
            fuel_direction = "neutral"
            fuel_confidence = "low"
            fuel_amount = 0.0

        signals.append(
            {
                "fuel": fuel,
                "direction": fuel_direction,
                "confidence": fuel_confidence,
                "score": fuel_score,
                "label": direction_label(fuel_direction),
                "expected_amount": fuel_amount,
                "timing": fuel_timing,
            }
        )

    return signals


def analyze_dominant_news_price(news_items):
    if not news_items:
        return None

    counts = {}
    total_sources = len(news_items)

    for item in news_items:
        source_name = item.get("source", "Haber")
        title = item.get("title", "")
        mentions = item.get("price_mentions", [])

        if not mentions and title:
            mentions = extract_news_price_mentions(title)

        seen_in_item = set()
        for mention in mentions:
            display = mention.get("display") if isinstance(mention, dict) else str(mention)
            if not display or display in seen_in_item:
                continue
            seen_in_item.add(display)

            if display not in counts:
                counts[display] = {
                    "display": display,
                    "count": 0,
                    "sources": set(),
                }

            counts[display]["count"] += 1
            counts[display]["sources"].add(source_name)

    if not counts:
        return None

    sorted_mentions = sorted(counts.values(), key=lambda x: x["count"], reverse=True)
    top_mention = sorted_mentions[0]

    return {
        "display": top_mention["display"],
        "count": top_mention["count"],
        "total_sources": total_sources,
        "detail": (
            f"İncelenen {total_sources} haber başlığının {top_mention['count']}'inde "
            f"net olarak {top_mention['display']} beklentisi telaffuz edildi."
        ),
    }


def collect_news_price_mentions(news_items):
    mentions = []
    seen = set()

    for item in news_items:
        for mention in item.get("price_mentions", []):
            display = mention.get("display") if isinstance(mention, dict) else str(mention)

            if not display or display in seen:
                continue

            seen.add(display)
            mentions.append(display)

    return mentions[:5]


def build_analysis_factors(direction, confidence, news_analysis, news_items, calculated_at):
    latest_news_time = news_items[0].get("published_at") if news_items else None
    dominant_price = analyze_dominant_news_price(news_items)

    factors = [
        {
            "label": "Guncel haber etkisi",
            "value": f"{news_analysis['score']:+d}",
            "tone": news_analysis["direction"],
            "detail": news_analysis["summary"],
        },
    ]

    if dominant_price:
        factors.append({
            "label": "Öne Çıkan Tutar (Çoğunluk)",
            "value": dominant_price["display"],
            "tone": news_analysis["direction"],
            "detail": dominant_price["detail"],
        })
    else:
        factors.append({
            "label": "Öne Çıkan Tutar",
            "value": "Net Tutar Bulunamadı",
            "tone": "neutral",
            "detail": "Son 24 saatteki haber başlıklarında henüz çoğunluğun birleştiği net bir zam/indirim rakamı yer almadı.",
        })

    factors.extend([
        {
            "label": "Haber guncelligi",
            "value": f"{len(news_items)} baslik",
            "tone": "neutral",
            "detail": (
                f"En yeni baslik: {latest_news_time}."
                if latest_news_time
                else f"Son {NEWS_MAX_AGE_HOURS} saatte uygun haber bulunamadi."
            ),
        },
        {
            "label": "Analiz kapsami",
            "value": direction_label(direction),
            "tone": direction,
            "detail": (
                f"{calculated_at.strftime('%d.%m.%Y %H:%M')} itibariyla sadece son "
                f"{NEWS_MAX_AGE_HOURS} saatteki haberler kullanildi. Guven: {confidence}."
            ),
        },
    ])

    return factors


def build_summary(direction, confidence, index_change_3d, index_change_7d, brent_change_3d, usd_change_3d):
    confidence_text = {
        "high": "guclu",
        "medium": "orta",
        "low": "dusuk",
    }.get(confidence, "dusuk")
    decisive_days = 3 if abs(index_change_3d) >= 2.5 else 7
    decisive_change = index_change_3d if decisive_days == 3 else index_change_7d

    if direction == "increase":
        return (
            f"Brent TL endeksi {decisive_days} piyasa gununde %{decisive_change:.2f} yukseldi. "
            f"Brent {format_percent(brent_change_3d)}, USD/TL {format_percent(usd_change_3d)} hareket etti; "
            f"yukari yonlu {confidence_text} sinyal olustu."
        )

    if direction == "decrease":
        return (
            f"Brent TL endeksi {decisive_days} piyasa gununde %{abs(decisive_change):.2f} geriledi. "
            f"Brent {format_percent(brent_change_3d)}, USD/TL {format_percent(usd_change_3d)} hareket etti; "
            f"asagi yonlu {confidence_text} sinyal olustu."
        )

    return (
        f"Brent TL endeksi 3 piyasa gununde %{index_change_3d:.2f} degisti. "
        "Pompa fiyatlari icin belirgin bir yukari ya da asagi baski olusmadi."
    )


def build_rule_based_ai_summary(direction, confidence, news_analysis, news_items):
    if direction == "increase":
        action = "zam riskini"
    elif direction == "decrease":
        action = "indirim ihtimalini"
    else:
        action = "net bir fiyat yonu olusmadigini"

    price_mentions = collect_news_price_mentions(news_items)
    price_note = (
        f"Haberlerde {', '.join(price_mentions[:3])} gibi tutarlar belirtiliyor. "
        if price_mentions
        else ""
    )

    return (
        f"Son {NEWS_MAX_AGE_HOURS} saatteki {len(news_items)} guncel haber basligina gore analiz "
        f"{action} isaret ediyor. Haber tarafinda: {news_analysis['summary']} "
        f"{price_note}"
        f"Guven seviyesi {confidence}. "
        f"Bu yorum tahmin niteligindedir; resmi fiyat degisikligi duyurusu degildir."
    )


def resolve_analysis_mode(ai_result):
    if ai_result and "groq" in (ai_result.get("model") or ""):
        return "groq"

    return "rules"


def call_groq_analysis(payload):
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        print(
            "UYARI: GROQ_API_KEY tanimli degil; Groq analizi atlanacak, kural tabanli analiz kullanilacak."
        )
        return None

    model = os.getenv("GROQ_MODEL") or "openai/gpt-oss-120b"
    pump_averages = payload.get("pump_averages_tl_per_l") or {}
    current_prices = {
        "Benzin": pump_averages.get("Benzin"),
        "Motorin": pump_averages.get("Motorin"),
        "LPG": pump_averages.get("LPG"),
    }

    prompt = (
        "Türkiye akaryakıt piyasası için verilen haberleri ve sayısal bağlamı kullanarak ileriye dönük pompa beklentisi çıkar.\n"
        "VERİ KAYNAKLARI (güvenilir, kod tarafından sağlandı):\n"
        "- pump_averages_tl_per_l: bugünkü 81 il pompa ortalamaları (₺/L)\n"
        "- gecmis_last_7_days: son 7 günün gecmis tablosu (ortalama fiyat ve günlük değişim TL)\n"
        "- macro: Brent (USD) ve USD/TRY ile son kayıt ve bir önceki kayda göre % değişim (varsa)\n"
        "- news: son haber başlıkları; age_hours ve bu_gece_already_applied alanlarına dikkat et\n"
        "- haberlerde_gecen_tutarlar: kodun haber metninden çıkardığı tutarlar (başlık + özet/açıklama); yalnızca bu listeden seçim yap\n"
        "KURALLAR:\n"
        "1. Geçmişte uygulanmış zam/indirim ('geldi', 'yansıdı', 'tabela değişti') gelecek beklenti DEĞİLDİR → ilgili yakıt neutral.\n"
        "2. 'bu gece' içeren başlıkta bu_gece_already_applied=true ise o beklenti artık geçmişte kabul edilir → neutral.\n"
        "3. expected_amount_tl: yalnızca haberlerde_gecen_tutarlar içindeki aynı yakıt ve yön için geçen tutar (zam +, indirim -). Liste dışı veya belirsizse null; ASLA uydurma.\n"
        "4. current_price ve expected_price alanlarını JSON'a yazma; bunlar sistemde hesaplanır.\n"
        "5. Somut yeni beklenti yoksa tüm yakıtlar neutral, expected_amount_tl null.\n"
        "6. timing: somut beklenti yoksa \"Gündemde değişim yok\"; varsa \"Bu gece yarısı\" veya \"Yarından itibaren\".\n"
        "7. confidence: kanıt gücüne göre high|medium|low; belirsizse low.\n"
        "8. summary: TEK kısa cümle, paragraf veya açıklama YOK. Biçim:\n"
        "   - Etkilenen her yakıt için: '<Yakıt> ↑ <tutar> TL' veya '<Yakıt> ↓ <tutar> TL' (';' ile ayır).\n"
        "     Örnek: 'Motorin ↑ 6,40 TL; Benzin ↓ 0,96 TL'\n"
        "   - Tek yakıt, tutarlı cümle de olabilir: 'Sadece motorin, 3 TL indirim bekleniyor.'\n"
        "   - Tutar yoksa: 'Motorin ↑ (tutar belirsiz)'\n"
        "   - Hiç değişiklik yoksa: 'Değişiklik beklenmiyor.'\n"
        "Yanıt: yalnızca geçerli JSON:\n"
        "{\n"
        "  \"direction\": \"neutral|increase|decrease\",\n"
        "  \"timing\": \"Gündemde değişim yok | Bu gece yarısı | Yarından itibaren\",\n"
        "  \"confidence\": \"high|medium|low\",\n"
        "  \"summary\": \"Motorin ↑ 6,40 TL; Benzin ↓ 0,96 TL\",\n"
        "  \"key_reason\": \"kısa gerekçe\",\n"
        "  \"signals\": [\n"
        "    {\"fuel\": \"Benzin|Motorin|LPG\", \"direction\": \"neutral|increase|decrease\", "
        "\"expected_amount_tl\": null, \"reason\": \"haber kaynağı veya kısa açıklama\"}\n"
        "  ]\n"
        "}\n"
        "Her Benzin, Motorin ve LPG için bir signals öğesi olmalı.\n\n"
        f"Analiz verisi:\n{json.dumps(payload, ensure_ascii=False)}"
    )

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
            },
            timeout=SCRAPER_REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        result = response.json()
        output_text = result["choices"][0]["message"]["content"]
        parsed = json.loads(output_text)

        news_extractions = payload.get("news_amount_extractions") or []
        fuel_signals = parse_groq_fuel_signals(parsed, current_prices, news_extractions)
        direction = derive_overall_direction(fuel_signals)
        timing = parsed.get("timing") or DEFAULT_TIMING
        confidence = parsed.get("confidence") or DEFAULT_CONFIDENCE

        if direction == "neutral":
            timing = DEFAULT_TIMING
            confidence = DEFAULT_CONFIDENCE

        summary = resolve_market_summary(parsed.get("summary"), fuel_signals)
        source_disagreement_note = (
            SOURCE_DISAGREEMENT_NOTE if payload.get("news_amount_source_disagreement") else None
        )

        primary_signal = next(
            (
                signal
                for signal in fuel_signals
                if signal.get("direction") in {"increase", "decrease"}
                and signal.get("expected_amount_tl") is not None
            ),
            None,
        )

        return {
            "model": f"groq:{model}",
            "direction": direction,
            "target_fuel": primary_signal.get("fuel") if primary_signal else "Yok",
            "expected_amount": primary_signal.get("expected_amount_tl") if primary_signal else None,
            "timing": timing,
            "summary": summary,
            "source_disagreement_note": source_disagreement_note,
            "confidence": confidence,
            "watch_level": "high" if direction != "neutral" else "low",
            "key_reason": parsed.get("key_reason", ""),
            "fuel_signals": fuel_signals,
            "groq_raw": parsed,
        }
    except Exception as error:
        print(f"Groq analizi hatasi: {error}")
        return None


def build_market_signal(price_changes=None, previous_price_memory=None):
    calculated_at = datetime.now(ISTANBUL_TZ)
    news_items = fetch_news_items()
    news_items = [
        enrich_news_item(item, calculated_at, normalize_text)
        for item in news_items
    ]
    price_analysis = merge_price_memory(summarize_price_changes(price_changes or []), previous_price_memory)
    news_analysis = score_news_items(news_items)
    direction = news_analysis["direction"]
    confidence = resolve_news_confidence(news_analysis["score"])
    score = abs(news_analysis["score"])
    analysis_factors = build_analysis_factors(
        direction,
        confidence,
        news_analysis,
        news_items,
        calculated_at,
    )

    price_rows = fetch_pump_price_rows()
    pump_averages = compute_pump_averages(price_rows, parse_float)
    gecmis_trend = format_gecmis_trend(fetch_gecmis_rows(7), parse_float)

    brent_history = []
    usd_history = []

    try:
        brent_history = fetch_brent_history(5)
    except Exception as error:
        print(f"Brent verisi analiz baglamina eklenemedi: {error}")

    try:
        usd_history = fetch_usd_try_history(5)
    except Exception as error:
        print(f"USD/TRY verisi analiz baglamina eklenemedi: {error}")

    macro = build_macro_snapshot(brent_history, usd_history)

    news_amount_extractions, news_amount_source_disagreement = aggregate_news_amount_extractions(
        news_items
    )
    haberlerde_gecen_tutarlar = build_haberlerde_gecen_tutarlar(news_items[:10])

    ai_payload = {
        "analysis_basis": "news_and_market_context",
        "news_lookback_hours": NEWS_MAX_AGE_HOURS,
        "calculated_at": calculated_at.isoformat(),
        "timezone": "Europe/Istanbul",
        "pump_averages_tl_per_l": {
            "Benzin": pump_averages.get("Benzin"),
            "Motorin": pump_averages.get("Motorin"),
            "LPG": pump_averages.get("LPG"),
            "city_count": pump_averages.get("city_count"),
        },
        "gecmis_last_7_days": gecmis_trend,
        "macro": macro,
        "haberlerde_gecen_tutarlar": haberlerde_gecen_tutarlar,
        "news_amount_extractions": news_amount_extractions,
        "news_amount_source_disagreement": news_amount_source_disagreement,
        "news_scoring_hint": {
            "direction": direction,
            "confidence": confidence,
            "score": news_analysis["score"],
        },
        "news": serialize_news_for_groq(news_items[:10]),
        "news_analysis": news_analysis,
    }
    ai_result = call_groq_analysis(ai_payload)
    target_fuel = ai_result.get("target_fuel") if ai_result else None
    expected_amount = ai_result.get("expected_amount") if ai_result else None
    timing = ai_result.get("timing") if ai_result else None

    if ai_result and ai_result.get("direction"):
        direction = ai_result["direction"]
        if direction == "neutral":
            score = 0
            confidence = DEFAULT_CONFIDENCE
        else:
            score = max(score, 85)
            confidence = ai_result.get("confidence", DEFAULT_CONFIDENCE)

    source_disagreement_note = ai_result.get("source_disagreement_note") if ai_result else None

    if ai_result and ai_result.get("fuel_signals"):
        ai_summary = ai_result.get("summary") or resolve_market_summary(
            None,
            ai_result["fuel_signals"],
        )
    elif ai_result and ai_result.get("summary"):
        ai_summary = ai_result["summary"]
    else:
        ai_summary = build_rule_based_ai_summary(direction, confidence, news_analysis, news_items)

    mode = resolve_analysis_mode(ai_result)

    if ai_result and ai_result.get("fuel_signals"):
        fuel_signals = build_mobile_fuel_signals(
            ai_result["fuel_signals"],
            confidence,
            score,
            timing=timing,
        )
    else:
        fuel_signals = build_fuel_signals(
            direction,
            confidence,
            score,
            target_fuel=target_fuel,
            expected_amount=expected_amount,
            timing=timing,
        )

    public_news_items = serialize_news_for_groq(news_items)

    return {
        "signal_date": calculated_at.strftime("%Y-%m-%d"),
        "direction": direction,
        "confidence": confidence,
        "score": score,
        "summary": ai_summary,
        "source_disagreement_note": source_disagreement_note,
        "brent_usd": macro.get("brent_usd"),
        "usd_try": macro.get("usd_try"),
        "brent_try_index": None,
        "brent_change_3d": macro.get("brent_change_pct"),
        "usd_change_3d": macro.get("usd_try_change_pct"),
        "index_change_3d": None,
        "index_change_7d": None,
        "signals": fuel_signals,
        "analysis": {
            "mode": mode,
            "analysis_basis": "news_and_market_context",
            "lookback_hours": NEWS_MAX_AGE_HOURS,
            "news_score": news_analysis["score"],
            "news_direction": news_analysis["direction"],
            "news_summary": news_analysis["summary"],
            "price_score": price_analysis["score"],
            "price_direction": price_analysis["direction"],
            "price_summary": price_analysis["summary"],
            "price_items": price_analysis["items"],
            "price_memory": {
                "source": price_analysis.get("memory_source", "none"),
                "remembered_at": price_analysis.get("remembered_at"),
            },
            "pump_averages_tl_per_l": ai_payload["pump_averages_tl_per_l"],
            "gecmis_last_7_days": gecmis_trend,
            "macro": macro,
            "factors": analysis_factors,
            "ai": ai_result,
        },
        "news_items": public_news_items,
        "sources": {
            "news_feeds": [feed["name"] for feed in NEWS_FEEDS],
            "news_lookback_hours": NEWS_MAX_AGE_HOURS,
        },
        "calculated_at": calculated_at.isoformat(),
    }
