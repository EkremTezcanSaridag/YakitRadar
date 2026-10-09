import csv
import io
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from xml.etree import ElementTree

import requests
from dotenv import load_dotenv

load_dotenv()

SCRAPER_RATE_LIMIT_DELAY = float(os.getenv("SCRAPER_RATE_LIMIT_DELAY", "1.0"))
SCRAPER_REQUEST_TIMEOUT = int(os.getenv("SCRAPER_REQUEST_TIMEOUT", "30"))
SCRAPER_MAX_RETRIES = int(os.getenv("SCRAPER_MAX_RETRIES", "3"))
SCRAPER_RETRY_BASE_DELAY = float(os.getenv("SCRAPER_RETRY_BASE_DELAY", "2.0"))


def resolve_istanbul_timezone():
    try:
        return ZoneInfo("Europe/Istanbul")
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=3))


ISTANBUL_TZ = resolve_istanbul_timezone()


def make_request_with_retry(url, headers=None, timeout=None):
    """Make HTTP request with exponential backoff retry logic."""
    if headers is None:
        headers = {"User-Agent": "YakitRadar/1.0"}
    if timeout is None:
        timeout = SCRAPER_REQUEST_TIMEOUT
    
    last_error = None
    for attempt in range(SCRAPER_MAX_RETRIES):
        try:
            response = requests.get(url, headers=headers, timeout=timeout)
            response.raise_for_status()
            
            if SCRAPER_RATE_LIMIT_DELAY > 0:
                time.sleep(SCRAPER_RATE_LIMIT_DELAY)
            
            return response
        except requests.exceptions.Timeout as e:
            last_error = e
            print(f"Timeout on attempt {attempt + 1}/{SCRAPER_MAX_RETRIES} for {url}")
        except requests.exceptions.RequestException as e:
            last_error = e
            status_code = getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            
            if status_code and 400 <= status_code < 500 and status_code != 429:
                raise
            
            print(f"Request failed on attempt {attempt + 1}/{SCRAPER_MAX_RETRIES} for {url}: {e}")
        
        if attempt < SCRAPER_MAX_RETRIES - 1:
            delay = SCRAPER_RETRY_BASE_DELAY * (2 ** attempt)
            print(f"Retrying in {delay} seconds...")
            time.sleep(delay)
    
    raise RuntimeError(f"Failed to fetch {url} after {SCRAPER_MAX_RETRIES} attempts: {last_error}")

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
NEWS_MAX_AGE_HOURS = int(os.getenv("NEWS_MAX_AGE_HOURS", "48"))
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

                normalized_title = normalize_text(title)

                if any(blocked in normalized_title for blocked in NEWS_BLOCKED_KEYWORDS):
                    continue

                source = node.findtext("source") or feed["name"]
                published_at = parse_rss_date(node.findtext("pubDate"))

                clean_source = source.strip()

                if is_blocked_news_source(clean_source) or not is_recent_news_item(published_at):
                    continue

                seen_titles.add(normalized_title)
                items.append(
                    {
                        "title": title,
                        "source": clean_source,
                        "url": (node.findtext("link") or "").strip(),
                        "published_at": published_at.isoformat() if published_at else None,
                        "price_mentions": extract_news_price_mentions(title, description),
                    }
                )
        except Exception as error:
            print(f"Haber akisi okunamadi ({feed['name']}): {error}")

    items.sort(key=lambda item: item.get("published_at") or "", reverse=True)
    return items[:15]

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

        has_already_applied = any(normalize_text(keyword) in normalized for keyword in NEWS_ALREADY_APPLIED_KEYWORDS)

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
        "items": previous_price_memory.get("items", []),
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


def extract_gemini_text(response_data):
    for candidate in response_data.get("candidates", []):
        content = candidate.get("content") or {}

        for part in content.get("parts", []):
            text = part.get("text")

            if text:
                return text

    return None


def call_gemini_analysis(payload):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        return None

    model = os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
    schema = {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "watch_level": {"type": "string", "enum": ["low", "medium", "high"]},
            "key_reason": {"type": "string"},
        },
        "required": ["summary", "watch_level", "key_reason"],
    }

    try:
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={
                "x-goog-api-key": api_key,
                "Content-Type": "application/json",
            },
            json={
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": (
                                    "Turkiye akaryakit piyasasi icin kisa, temkinli ve kanita dayali analiz yaz.\n"
                                    "KURALLAR:\n"
                                    "1. Soru isareti (?) iceren veya 'zam mi geliyor?', 'indirim var mi?' gibi spekulatif basliklari kesinlikle resmi zam/indirim karari olarak kabul etme.\n"
                                    "2. Yalnizca 'bu gece yarisi', 'tabelalara yansidi' veya netlesmis resmi ifadeleri zam/indirim olarak ozetle; aksi halde temkinli ol.\n"
                                    "3. Net tutar yoksa rakam uydurma. Teyitli degisiklik yoksa watch_level degerini 'low' yap.\n"
                                    "Sadece JSON uret. Veri:\n"
                                    f"{json.dumps(payload, ensure_ascii=False)}"
                                )
                            }
                        ],
                    },
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseSchema": schema,
                },
            },
            timeout=SCRAPER_REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        output_text = extract_gemini_text(response.json())

        if not output_text:
            return None

        parsed = json.loads(output_text)

        return {
            "model": model,
            "summary": parsed["summary"],
            "watch_level": parsed["watch_level"],
            "key_reason": parsed["key_reason"],
        }
    except Exception as error:
        print(f"Gemini analizi kullanilamadi, kural tabanli analize donuldu: {error}")
        return None


def call_groq_analysis(payload):
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        return None

    model = os.getenv("GROQ_MODEL") or "openai/gpt-oss-120b"

    prompt = (
        "Türkiye akaryakıt piyasası için son haber verilerini inceleyerek en gerçekçi piyasa beklentisi analizini yap.\n"
        "TÜRKİYE AKARYAKIT PİYASASI KURALLARI:\n"
        "1. GEÇMİŞ ZAMAN (UYGULANMIŞ İNDİRİM/ZAM) vs GELECEK ZAMAN (YENİ BEKLENTİ) AYRIMI (ÇOK KRİTİK):\n"
        "   - Eğer haberlerde 'indirim geldi', 'zam geldi', 'tabela değişti', 'pompaya yansıdı', 'fiyatlar güncellendi', 'indirim sonrası liste' yazıyorsa, bu indirim/zam ZATEN GEÇMİŞTE KALMIŞTIR VE POMPAYA YANSIMIŞTIR! Gelecek için yeni bir beklenti DEĞİLDİR.\n"
        "   - Bu durumda direction='neutral', target_fuel='Yok', expected_amount=0 olmalı ve özetinde 'Motorine/benzine uygulanan indirim/zam pompa fiyatlarına yansıdı. Şu an için piyasada yeni bir fiyat değişikliği beklenmemektedir.' denmelidir!\n"
        "2. Yalnızca henüz pompaya yansımamış ileriye dönük somut yeni bir beklenti varsa ('bu gece yarısı bekleniyor', 'yarından itibaren geçerli olacak', 'tabelalar bu gece değişecek') direction='decrease' veya 'increase', target_fuel ve expected_amount tespit edilmelidir.\n"
        "3. Türkiye'de akaryakıt zam ve indirimleri resmi kurumlarca (EPDK/EPGİS) önceden bültenle açıklanmaz; daima 'sektör kaynaklarından edinilen bilgiye göre' ekonomi basınına (Ekonomim, Habertürk, NTV, Sözcü vb.) yansır ve gece yarısı pompaya uygulanır.\n"
        "4. Ancak hiçbir tutar veya somut beklenti içermeyen, sadece 'fiyatlar ne kadar?', 'kaç TL oldu?' gibi genel günlük fiyat listesi sorgusu başlıklarını tek başına zam/indirim sayma.\n"
        "5. Eğer piyasada teyitli veya somut yeni bir beklenti yoksa direction='neutral', target_fuel='Yok', expected_amount=0 yap.\n"
        "Format: Sadece geçerli bir JSON üret:\n"
        "{\n"
        "  \"direction\": \"neutral|increase|decrease\",\n"
        "  \"target_fuel\": \"Motorin|Benzin|LPG|Genel|Yok\",\n"
        "  \"expected_amount\": 0,\n"
        "  \"timing\": \"Gündemde değişim yok | Bu gece yarısı | Yarından itibaren\",\n"
        "  \"summary\": \"Motorin litre fiyatına uygulanan indirim pompa tabelalarına yansıdı. Şu an için yeni bir zam veya indirim kararı bulunmamaktadır, fiyatlar dengelidir.\",\n"
        "  \"confidence\": \"high|medium|low\",\n"
        "  \"key_reason\": \"...\"\n"
        "}\n\n"
        f"Haber Verisi:\n{json.dumps(payload, ensure_ascii=False)}"
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

        expected_amount = None
        try:
            raw_amt = parsed.get("expected_amount")
            if raw_amt is not None:
                expected_amount = float(str(raw_amt).replace(",", ".").strip())
        except (ValueError, TypeError):
            expected_amount = None

        return {
            "model": f"groq:{model}",
            "direction": parsed.get("direction", "neutral"),
            "target_fuel": parsed.get("target_fuel", "Genel"),
            "expected_amount": expected_amount,
            "timing": parsed.get("timing", "Bu gece yarısı"),
            "summary": parsed.get("summary", ""),
            "confidence": parsed.get("confidence", "high"),
            "watch_level": parsed.get("watch_level", "high" if parsed.get("direction") != "neutral" else "low"),
            "key_reason": parsed.get("key_reason", ""),
        }
    except Exception as error:
        print(f"Groq analizi hatasi: {error}")
        return None


def build_market_signal(price_changes=None, previous_price_memory=None):
    news_items = fetch_news_items()
    price_analysis = merge_price_memory(summarize_price_changes(price_changes or []), previous_price_memory)
    news_analysis = score_news_items(news_items)
    calculated_at = datetime.now(ISTANBUL_TZ)
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
    ai_payload = {
        "analysis_basis": "news_only",
        "news_lookback_hours": NEWS_MAX_AGE_HOURS,
        "calculated_at": calculated_at.isoformat(),
        "direction": direction,
        "confidence": confidence,
        "score": score,
        "news": news_items[:10],
        "news_analysis": news_analysis,
    }
    ai_result = call_groq_analysis(ai_payload) or call_gemini_analysis(ai_payload)
    target_fuel = ai_result.get("target_fuel") if ai_result else None
    expected_amount = ai_result.get("expected_amount") if ai_result else None
    timing = ai_result.get("timing") if ai_result else None

    if ai_result and ai_result.get("direction"):
        direction = ai_result["direction"]
        if direction == "neutral":
            score = 0
            confidence = "high"
        else:
            score = max(score, 85)
            confidence = ai_result.get("confidence", "high")

    ai_summary = (
        ai_result["summary"]
        if ai_result and ai_result.get("summary")
        else build_rule_based_ai_summary(direction, confidence, news_analysis, news_items)
    )

    mode = "groq" if (ai_result and "groq" in ai_result.get("model", "")) else ("gemini" if ai_result else "rules")

    return {
        "signal_date": calculated_at.strftime("%Y-%m-%d"),
        "direction": direction,
        "confidence": confidence,
        "score": score,
        "summary": ai_summary,
        "brent_usd": None,
        "usd_try": None,
        "brent_try_index": None,
        "brent_change_3d": None,
        "usd_change_3d": None,
        "index_change_3d": None,
        "index_change_7d": None,
        "signals": build_fuel_signals(
            direction,
            confidence,
            score,
            target_fuel=target_fuel,
            expected_amount=expected_amount,
            timing=timing,
        ),
        "analysis": {
            "mode": mode,
            "analysis_basis": "news_only",
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
            "factors": analysis_factors,
            "ai": ai_result,
        },
        "news_items": news_items,
        "sources": {
            "news_feeds": [feed["name"] for feed in NEWS_FEEDS],
            "news_lookback_hours": NEWS_MAX_AGE_HOURS,
        },
        "calculated_at": calculated_at.isoformat(),
    }
