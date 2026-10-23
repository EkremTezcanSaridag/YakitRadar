import json
import os
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

from http_client import SCRAPER_REQUEST_TIMEOUT, make_request_with_retry
from market_signals import build_market_signal
from expo_push_client import fetch_push_receipts, parse_receipt_outcomes, send_expo_messages
from notification_rules import (
    dedupe_price_changes,
    expected_change_dedupe_key,
    filter_expected_change_signals,
    fuel_matches_tracked,
    istanbul_quiet_hours_active,
    is_pending_price_change_stale,
    price_change_dedupe_key,
)
from push_token_maintenance import apply_delivery_errors, disable_stale_tokens
from price_memory_validation import sanitize_price_memory_items
from price_scrape_guard import (
    MIN_SCRAPED_CITY_COUNT,
    PriceSanityError,
    PriceSourceValidationError,
    assert_bulk_price_deviation_ok,
    assert_scraped_city_count,
    log_scrape_failure_summary,
    validate_aytemiz_akaryakit_page,
    validate_aytemiz_lpg_page,
    validate_gecmis_daily_deltas,
)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
NOTIFICATION_MIN_CHANGE = float(os.getenv("NOTIFICATION_MIN_CHANGE", "0.01"))
MAX_REASONABLE_PRICE_CHANGE = float(os.getenv("MAX_REASONABLE_PRICE_CHANGE", "8.0"))
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
FUEL_PRICES_URL = "https://www.aytemiz.com.tr/akaryakit-fiyatlari/benzin-fiyatlari"
LPG_PRICES_URL = "https://www.aytemiz.com.tr/akaryakit-fiyatlari/lpg-fiyatlari"
MIN_EXPECTED_CITY_COUNT = MIN_SCRAPED_CITY_COUNT
AYTEMIZ_HEADERS = {"User-Agent": "Mozilla/5.0"}


def resolve_istanbul_timezone():
    try:
        return ZoneInfo("Europe/Istanbul")
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=3))


ISTANBUL_TZ = resolve_istanbul_timezone()

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

FUEL_FIELDS = {
    "benzin_95": "Benzin",
    "motorin": "Motorin",
    "lpg": "LPG",
}


def fiyat_parse(deger):
    if deger is None:
        return None

    if isinstance(deger, (int, float)):
        return float(deger)

    temiz = str(deger).replace("TL", "").replace("₺", "").replace(" ", "").replace(",", ".")

    try:
        return float(temiz)
    except ValueError:
        return None


def fiyat_format(deger):
    return f"{deger:.2f} TL"


def liste_degeri(deger):
    if isinstance(deger, list):
        return [str(item) for item in deger if item]

    if isinstance(deger, str):
        try:
            parsed = json.loads(deger)

            if isinstance(parsed, list):
                return [str(item) for item in parsed if item]
        except json.JSONDecodeError:
            return [deger]

    return []


def akaryakit_fiyatlarini_cek():
    try:
        response = make_request_with_retry(FUEL_PRICES_URL, headers=AYTEMIZ_HEADERS)
    except Exception as e:
        print(f"HATA: Akaryakit fiyatlari cekilemedi: {e}")
        raise RuntimeError(f"Akaryakit sayfasindan fiyatlar cekilemedi: {e}")

    soup = BeautifulSoup(response.text, "html.parser")

    try:
        validate_aytemiz_akaryakit_page(soup)
    except PriceSourceValidationError as hata:
        log_scrape_failure_summary("akaryakit", response, match_count=0)
        raise RuntimeError(str(hata)) from hata

    duz_metin = soup.get_text(separator=" ")
    desen = (
        r"([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s?/\s?[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)"
        r"\s*(\d{2},\d{2})\s*(\d{2},\d{2})\s*(\d{2},\d{2})\s*(\d{2},\d{2})\s*(\d{2},\d{2})"
    )
    guncelleme = datetime.now(ISTANBUL_TZ).strftime("%Y-%m-%d %H:%M")
    il_verileri = {}

    for eslesme in re.finditer(desen, duz_metin):
        il_adi = eslesme.group(1).strip()

        if il_adi in il_verileri:
            continue

        il_verileri[il_adi] = {
            "il": il_adi,
            "benzin_95": eslesme.group(2),
            "motorin": eslesme.group(3),
            "guncelleme": guncelleme,
        }

    if len(il_verileri) < MIN_EXPECTED_CITY_COUNT:
        ornek = [
            f"{kayit['il']} benzin={kayit.get('benzin_95')}"
            for kayit in list(il_verileri.values())[:5]
        ]
        log_scrape_failure_summary(
            "akaryakit",
            response,
            match_count=len(il_verileri),
            sample_rows=ornek,
        )
        raise RuntimeError(f"Akaryakit sayfasindan yalnizca {len(il_verileri)} il okunabildi")

    return il_verileri


def lpg_fiyatlarini_cek():
    try:
        response = make_request_with_retry(LPG_PRICES_URL, headers=AYTEMIZ_HEADERS)
    except Exception as e:
        print(f"HATA: LPG fiyatlari cekilemedi: {e}")
        raise RuntimeError(f"LPG sayfasindan fiyatlar cekilemedi: {e}")
    soup = BeautifulSoup(response.text, "html.parser")

    try:
        validate_aytemiz_lpg_page(soup)
    except PriceSourceValidationError as hata:
        log_scrape_failure_summary("lpg", response, match_count=0)
        raise RuntimeError(str(hata)) from hata

    lpg_tablosu = next(
        (tablo for tablo in soup.find_all("table") if "oto lpg" in tablo.get_text(" ", strip=True).lower()),
        None,
    )

    if lpg_tablosu is None:
        raise RuntimeError("Aytemiz LPG sayfasinda Oto LPG tablosu bulunamadi")

    lpg_verileri = {}

    for satir in lpg_tablosu.find_all("tr"):
        hucreler = [
            hucre.get_text(" ", strip=True)
            for hucre in satir.find_all("td", recursive=False)
        ]

        if len(hucreler) != 2 or fiyat_parse(hucreler[1]) is None:
            continue

        lpg_verileri[hucreler[0]] = hucreler[1]

    if len(lpg_verileri) < MIN_EXPECTED_CITY_COUNT:
        ornek = [f"{il}={fiyat}" for il, fiyat in list(lpg_verileri.items())[:5]]
        log_scrape_failure_summary(
            "lpg",
            response,
            match_count=len(lpg_verileri),
            sample_rows=ornek,
        )
        raise RuntimeError(f"LPG sayfasindan yalnizca {len(lpg_verileri)} il okunabildi")

    return lpg_verileri


def istanbul_bolgelerini_birlestir(il_verileri):
    istanbul_bolgeleri = [il for il in il_verileri if il.startswith("İstanbul /")]

    if not istanbul_bolgeleri:
        return il_verileri

    if len(istanbul_bolgeleri) != 2:
        raise RuntimeError(f"Istanbul icin beklenmeyen bolge kaydi: {istanbul_bolgeleri}")

    birlesik_kayit = {
        "il": "İstanbul",
        "guncelleme": il_verileri[istanbul_bolgeleri[0]]["guncelleme"],
    }

    for alan in FUEL_FIELDS:
        degerler = [fiyat_parse(il_verileri[bolge].get(alan)) for bolge in istanbul_bolgeleri]

        if any(deger is None for deger in degerler):
            raise RuntimeError(f"Istanbul {alan} fiyati okunamadi")

        birlesik_kayit[alan] = f"{sum(degerler) / len(degerler):.2f}".replace(".", ",")

    for bolge in istanbul_bolgeleri:
        del il_verileri[bolge]

    il_verileri["İstanbul"] = birlesik_kayit
    return il_verileri


def tum_fiyatlari_cek():
    il_verileri = akaryakit_fiyatlarini_cek()
    lpg_verileri = lpg_fiyatlarini_cek()
    eksik_lpg = []

    for il_adi, kayit in il_verileri.items():
        lpg_il_adi = il_adi.split("/", 1)[0].strip()
        lpg_fiyati = lpg_verileri.get(il_adi)

        if lpg_fiyati is None:
            lpg_fiyati = lpg_verileri.get(lpg_il_adi)

        if lpg_fiyati is None:
            eksik_lpg.append(il_adi)
            continue

        kayit["lpg"] = lpg_fiyati

    if eksik_lpg:
        raise RuntimeError(f"LPG fiyati eslesmeyen iller: {', '.join(eksik_lpg)}")

    merged = istanbul_bolgelerini_birlestir(il_verileri)
    assert_scraped_city_count(len(merged))
    return merged


def mevcut_fiyatlari_oku():
    try:
        sonuc = supabase.table("fiyatlar").select("il, benzin_95, motorin, lpg").execute()
    except Exception as hata:
        print(f"Onceki fiyatlar okunamadi, bildirim karsilastirmasi atlanabilir: {hata}")
        return {}

    return {kayit["il"]: kayit for kayit in sonuc.data or []}


def fiyat_degisimlerini_hesapla(onceki, yeni):
    degisimler = []

    for il_adi, yeni_kayit in yeni.items():
        onceki_kayit = onceki.get(il_adi)

        if not onceki_kayit:
            continue

        for alan, yakit_adi in FUEL_FIELDS.items():
            eski_fiyat = fiyat_parse(onceki_kayit.get(alan))
            yeni_fiyat = fiyat_parse(yeni_kayit.get(alan))

            if eski_fiyat is None or yeni_fiyat is None:
                continue

            fark = round(yeni_fiyat - eski_fiyat, 2)

            if abs(fark) < NOTIFICATION_MIN_CHANGE:
                continue

            if abs(fark) > MAX_REASONABLE_PRICE_CHANGE:
                print(
                    f"Olagan disi fiyat farki bildirimden atlandi: {il_adi} {yakit_adi} "
                    f"{eski_fiyat:.2f} -> {yeni_fiyat:.2f}"
                )
                continue

            degisimler.append(
                {
                    "city": il_adi,
                    "fuel": yakit_adi,
                    "field": alan,
                    "old_price": eski_fiyat,
                    "new_price": yeni_fiyat,
                    "diff": fark,
                    "direction": "increase" if fark > 0 else "decrease",
                }
            )

    return sorted(degisimler, key=lambda item: abs(item["diff"]), reverse=True)


def degisim_ozeti(degisimler, limit=8):
    return [
        {
            "city": degisim["city"],
            "fuel": degisim["fuel"],
            "diff": degisim["diff"],
            "old_price": degisim.get("old_price"),
            "new_price": degisim.get("new_price"),
            "source": degisim.get("source", "price_change"),
        }
        for degisim in degisimler[:limit]
    ]


def fiyat_degisim_gecmisi_kaydet(degisimler):
    if not degisimler:
        return

    event_at = datetime.now(ISTANBUL_TZ).isoformat()
    kayitlar = [
        {
            "city": degisim["city"],
            "fuel": degisim["fuel"],
            "old_price": degisim["old_price"],
            "new_price": degisim["new_price"],
            "diff": degisim["diff"],
            "direction": degisim["direction"],
            "event_at": event_at,
        }
        for degisim in degisimler
        if degisim.get("source", "price_change") == "price_change"
    ]

    if not kayitlar:
        return

    try:
        supabase.table("price_change_events").insert(kayitlar).execute()
        print(f"Fiyat degisimi gecmisine {len(kayitlar)} olay yazildi")
    except Exception as hata:
        print("Fiyat degisimi gecmisi yazilamadi. backend/supabase_price_change_events.sql dosyasini calistirin.")
        print(f"Detay: {hata}")


def supabase_yaz(veri):
    for kayit in veri.values():
        supabase.table("fiyatlar").upsert(kayit).execute()

    supabase.table("fiyatlar").delete().in_("il", ["İstanbul / Anadolu", "İstanbul / Avrupa"]).execute()

    print(f"Supabase'e {len(veri)} il yazildi")


def gecmis_kaydet(veri):
    benzin_liste = []
    motorin_liste = []
    lpg_liste = []

    for kayit in veri.values():
        benzin = fiyat_parse(kayit.get("benzin_95"))
        motorin = fiyat_parse(kayit.get("motorin"))
        lpg = fiyat_parse(kayit.get("lpg"))

        if benzin is not None:
            benzin_liste.append(benzin)
        if motorin is not None:
            motorin_liste.append(motorin)
        if lpg is not None:
            lpg_liste.append(lpg)

    if not benzin_liste or not motorin_liste or not lpg_liste:
        return

    bugun = datetime.now(ISTANBUL_TZ).strftime("%Y-%m-%d")
    ort_benzin = round(sum(benzin_liste) / len(benzin_liste), 2)
    ort_motorin = round(sum(motorin_liste) / len(motorin_liste), 2)
    ort_lpg = round(sum(lpg_liste) / len(lpg_liste), 2)

    # Onceki gunun kaydini bul (bugunden kucuk en son tarih)
    onceki = (
        supabase.table("gecmis")
        .select("*")
        .lt("tarih", bugun)
        .order("tarih", desc=True)
        .limit(1)
        .execute()
    )

    benzin_degisim = "0.00"
    motorin_degisim = "0.00"
    lpg_degisim = "0.00"

    if onceki.data:
        onceki_kayit = onceki.data[0]
        benzin_degisim = str(round(ort_benzin - float(onceki_kayit["benzin_95"]), 2))
        motorin_degisim = str(round(ort_motorin - float(onceki_kayit["motorin"]), 2))
        lpg_degisim = str(round(ort_lpg - float(onceki_kayit["lpg"]), 2))

        validate_gecmis_daily_deltas(
            float(benzin_degisim),
            float(motorin_degisim),
            float(lpg_degisim),
            MAX_REASONABLE_PRICE_CHANGE,
        )

    kayit_verisi = {
        "tarih": bugun,
        "benzin_95": str(ort_benzin),
        "motorin": str(ort_motorin),
        "lpg": str(ort_lpg),
        "benzin_degisim": benzin_degisim,
        "motorin_degisim": motorin_degisim,
        "lpg_degisim": lpg_degisim,
    }

    # Bugune ait mevcut kayit var mi kontrol et
    bugunku = supabase.table("gecmis").select("id").eq("tarih", bugun).execute()

    if bugunku.data and len(bugunku.data) > 0:
        hedef_id = bugunku.data[0]["id"]
        supabase.table("gecmis").update(kayit_verisi).eq("id", hedef_id).execute()
        if len(bugunku.data) > 1:
            fazla_idler = [k["id"] for k in bugunku.data[1:] if "id" in k]
            if fazla_idler:
                supabase.table("gecmis").delete().in_("id", fazla_idler).execute()
        print(f"Gecmis tablosunda bugunun ({bugun}) kaydi guncellendi (ID: {hedef_id}): Benzin {ort_benzin}, Motorin {ort_motorin}, LPG {ort_lpg}")
    else:
        supabase.table("gecmis").insert(kayit_verisi).execute()
        print(f"Gecmis tablosuna yeni gun eklendi ({bugun}): Benzin {ort_benzin}, Motorin {ort_motorin}, LPG {ort_lpg}")


def push_tokenlarini_oku():
    try:
        sonuc = supabase.table("push_tokens").select("*").eq("enabled", True).execute()
    except Exception as hata:
        print("Push token tablosu okunamadi. backend/supabase_notifications.sql dosyasini Supabase'de calistirin.")
        print(f"Detay: {hata}")
        return []

    return sonuc.data or []


def sessiz_saatte_mi(token_kayit):
    if not token_kayit.get("quiet_hours", True):
        return False

    return istanbul_quiet_hours_active(datetime.now(ISTANBUL_TZ))


def bugun_signal_tarihi():
    return datetime.now(ISTANBUL_TZ).strftime("%Y-%m-%d")


def pending_fiyat_degisimleri_kaydet(degisimler):
    signal_date = bugun_signal_tarihi()
    now_iso = datetime.now(ISTANBUL_TZ).isoformat()
    kaydedilen = 0

    for degisim in degisimler or []:
        if degisim.get("source") in {"price_memory", "expected_change"}:
            continue

        dedupe_key = price_change_dedupe_key(degisim, signal_date)

        try:
            supabase.table("pending_price_notifications").upsert(
                {
                    "dedupe_key": dedupe_key,
                    "change_payload": degisim,
                    "detected_at": now_iso,
                },
                on_conflict="dedupe_key",
            ).execute()
            kaydedilen += 1
        except Exception as hata:
            print(f"Bekleyen fiyat bildirimi kaydedilemedi ({dedupe_key}): {hata}")

    if kaydedilen:
        print(f"Sessiz saat kuyruguna {kaydedilen} fiyat degisimi eklendi")


def bekleyen_fiyat_degisimlerini_oku():
    try:
        sonuc = (
            supabase.table("pending_price_notifications")
            .select("dedupe_key, change_payload, detected_at")
            .is_("sent_at", "null")
            .execute()
        )
    except Exception as hata:
        print(f"Bekleyen fiyat bildirimleri okunamadi: {hata}")
        return []

    kayitlar = sonuc.data or []
    now = datetime.now(ISTANBUL_TZ)
    taze_kayitlar = []
    eski_dedupe_keys = []

    for kayit in kayitlar:
        if is_pending_price_change_stale(kayit.get("detected_at"), now):
            eski_dedupe_keys.append(kayit["dedupe_key"])
        else:
            taze_kayitlar.append(kayit)

    if eski_dedupe_keys:
        try:
            bekleyen_fiyat_degisimlerini_gonderildi_isaretle(eski_dedupe_keys)
            print(
                f"{len(eski_dedupe_keys)} bekleyen fiyat bildirimi 24 saatten eski oldugu icin kapatildi"
            )
        except Exception as hata:
            print(f"Eski bekleyen fiyat bildirimleri kapatilamadi: {hata}")

    return taze_kayitlar


def bekleyen_fiyat_degisimlerini_gonderildi_isaretle(dedupe_keys):
    if not dedupe_keys:
        return

    now_iso = datetime.now(ISTANBUL_TZ).isoformat()

    try:
        supabase.table("pending_price_notifications").update({"sent_at": now_iso}).in_(
            "dedupe_key",
            dedupe_keys,
        ).execute()
    except Exception as hata:
        print(f"Bekleyen fiyat bildirimleri gonderildi olarak isaretlenemedi: {hata}")


def token_icin_degisim_sec(token_kayit, degisimler):
    takip_iller = {item.lower() for item in liste_degeri(token_kayit.get("tracked_cities"))}
    takip_yakitlar = {item.lower() for item in liste_degeri(token_kayit.get("tracked_fuels"))}
    city_alerts = token_kayit.get("city_alerts", True)
    daily_alerts = token_kayit.get("daily_alerts", True)

    if city_alerts:
        adaylar = [
            degisim
            for degisim in degisimler
            if (not takip_iller or degisim["city"].lower() in takip_iller)
            and (not takip_yakitlar or degisim["fuel"].lower() in takip_yakitlar)
        ]

        if adaylar:
            return adaylar[0]

    if daily_alerts and degisimler:
        return degisimler[0]

    return None


def bildirim_mesaji_olustur(token_kayit, degisim):
    yon = "artti" if degisim["diff"] > 0 else "dustu"
    hareket = "artis" if degisim["diff"] > 0 else "indirim"
    yeni_fiyat = degisim.get("new_price")

    if degisim.get("source") == "expected_change":
        amount = abs(float(degisim.get("diff") or 0))
        hareket = "artis" if degisim.get("direction") == "increase" else "indirim"
        timing = degisim.get("timing") or "yakinda"

        return {
            "to": token_kayit["expo_push_token"],
            "sound": "default",
            "title": f"Beklenen {degisim['fuel']} {hareket}",
            "body": (
                f"Piyasa analizi: yaklasik {amount:.2f} TL/litre {hareket} beklentisi ({timing})."
            ),
            "data": {
                "fuel": degisim["fuel"],
                "type": "expected_change",
            },
        }

    if degisim.get("source") == "price_memory":
        return {
            "to": token_kayit["expo_push_token"],
            "sound": "default",
            "title": f"{degisim['fuel']} icin gunluk {hareket} sinyali",
            "body": (
                f"{degisim['city']} {degisim['fuel']} tarafinda bugun "
                f"{abs(degisim['diff']):.2f} TL {yon} etkisi korunuyor."
            ),
            "data": {
                "city": degisim["city"],
                "fuel": degisim["fuel"],
                "type": "fuel_memory_change",
            },
        }

    return {
        "to": token_kayit["expo_push_token"],
        "sound": "default",
        "title": f"{degisim['fuel']} fiyatinda {hareket}",
        "body": (
            f"{degisim['city']} {degisim['fuel']} {abs(degisim['diff']):.2f} TL {yon}. "
            f"Yeni fiyat: {fiyat_format(yeni_fiyat)}"
        ),
        "data": {
            "city": degisim["city"],
            "fuel": degisim["fuel"],
            "newPrice": degisim["new_price"],
            "oldPrice": degisim["old_price"],
            "type": "fuel_change",
        },
    }


def parcalara_bol(liste, boyut):
    for index in range(0, len(liste), boyut):
        yield liste[index : index + boyut]


def process_expo_push_delivery(messages, send_responses):
    ticket_ids = []
    delivery_summary = {
        "expo_responses": send_responses,
        "receipt_errors": [],
        "immediate_errors": [],
        "receipt_ok_count": 0,
        "disabled_tokens": 0,
    }

    if not messages or not send_responses:
        return delivery_summary

    try:
        from expo_push_client import extract_ticket_ids

        ticket_ids = extract_ticket_ids(send_responses)
        receipt_payload = fetch_push_receipts(ticket_ids) if ticket_ids else {}
        parsed = parse_receipt_outcomes(send_responses, receipt_payload, messages)
        delivery_summary.update(
            {
                "expo_receipts": parsed.get("receipt_payload"),
                "receipt_errors": parsed.get("receipt_errors") or [],
                "immediate_errors": parsed.get("immediate_errors") or [],
                "receipt_ok_count": parsed.get("receipt_ok_count") or 0,
                "ticket_ids": parsed.get("ticket_ids") or [],
            }
        )
        all_errors = delivery_summary["receipt_errors"] + delivery_summary["immediate_errors"]
        delivery_summary["disabled_tokens"] = apply_delivery_errors(supabase, all_errors)
    except Exception as error:
        delivery_summary["receipt_fetch_error"] = str(error)
        print(f"Expo push receipt sorgusu basarisiz: {error}")

    return delivery_summary


def bildirim_log_kaydet(
    mesaj_sayisi,
    degisim_sayisi,
    status="sent",
    reason=None,
    token_count=0,
    candidate_count=0,
    skipped_quiet_count=0,
    skipped_empty_token_count=0,
    skipped_no_match_count=0,
    error_message=None,
    details=None,
):
    try:
        supabase.table("notification_logs").insert(
            {
                "status": status,
                "reason": reason,
                "sent_count": mesaj_sayisi,
                "change_count": degisim_sayisi,
                "token_count": token_count,
                "candidate_count": candidate_count,
                "skipped_quiet_count": skipped_quiet_count,
                "skipped_empty_token_count": skipped_empty_token_count,
                "skipped_no_match_count": skipped_no_match_count,
                "error_message": error_message,
                "details": details or {},
                "created_at": datetime.now(ISTANBUL_TZ).isoformat(),
            }
        ).execute()
    except Exception as hata:
        print(f"Bildirim audit log kaydi yazilamadi: {hata}")


def gunluk_pompa_hafizasi_oku():
    bugun = datetime.now(ISTANBUL_TZ).strftime("%Y-%m-%d")

    try:
        sonuc = (
            supabase.table("market_signals")
            .select("analysis")
            .eq("signal_date", bugun)
            .limit(1)
            .execute()
        )
    except Exception as hata:
        print(f"Gunluk pompa hafizasi okunamadi: {hata}")
        return None

    if not sonuc.data:
        return None

    analysis = sonuc.data[0].get("analysis") or {}
    price_score = int(analysis.get("price_score") or 0)

    if price_score == 0:
        return None

    return {
        "score": price_score,
        "direction": analysis.get("price_direction", "neutral"),
        "summary": analysis.get("price_summary"),
        "items": sanitize_price_memory_items(analysis.get("price_items", [])),
        "remembered_at": analysis.get("price_memory", {}).get("remembered_at")
        or datetime.now(ISTANBUL_TZ).isoformat(),
    }


def gunluk_hafiza_bildirimi_gonderildi_mi():
    bugun = datetime.now(ISTANBUL_TZ).strftime("%Y-%m-%dT00:00:00+03:00")

    try:
        sonuc = (
            supabase.table("notification_logs")
            .select("id")
            .eq("reason", "price_memory")
            .gte("created_at", bugun)
            .limit(1)
            .execute()
        )
    except Exception as hata:
        print(f"Gunluk hafiza bildirim logu okunamadi: {hata}")
        return False

    return bool(sonuc.data)


def hafiza_degisimi_olustur(price_memory):
    if not price_memory or int(price_memory.get("score") or 0) == 0:
        return []

    degisimler = []

    for item in sanitize_price_memory_items(price_memory.get("items") or []):
        average_diff = float(item.get("average_diff") or 0)

        if average_diff == 0:
            continue

        degisimler.append(
            {
                "city": "Turkiye geneli",
                "fuel": item.get("fuel", "Benzin"),
                "field": None,
                "old_price": None,
                "new_price": None,
                "diff": average_diff,
                "direction": "increase" if average_diff > 0 else "decrease",
                "source": "price_memory",
            }
        )

    return sorted(degisimler, key=lambda item: abs(item["diff"]), reverse=True)


def piyasa_sinyali_kaydet(degisimler=None, onceki_pompa_hafizasi=None):
    from market_signals import prepare_market_signal_row

    sinyal = build_market_signal(degisimler or [], onceki_pompa_hafizasi)
    row = prepare_market_signal_row(sinyal)

    try:
        with open("market_signals.json", "w", encoding="utf-8") as file:
            json.dump(row, file, ensure_ascii=False, indent=2)
    except Exception as io_err:
        print(f"Yerel market_signals.json yazılamadı: {io_err}")

    supabase.table("market_signals").upsert(row, on_conflict="signal_date").execute()
    print(
        "Piyasa sinyali kaydedildi: "
        f"{row['direction']} / {row['confidence']} / skor {row['score']}"
    )
    return row


def test_bildirimi_gonder(installation_id):
    disable_stale_tokens(supabase)
    tokenlar = push_tokenlarini_oku()
    hedefler = [token for token in tokenlar if token.get("installation_id") == installation_id]

    if not hedefler:
        print("Test bildirimi icin hedef cihaz bulunamadi")
        bildirim_log_kaydet(0, 0, status="skipped", reason="test_target_not_found")
        return

    mesajlar = [
        {
            "to": token["expo_push_token"],
            "sound": "default",
            "title": "Yakit Radar test bildirimi",
            "body": "Backend, Expo Push ve cihaz tokeni dogrulandi.",
            "data": {"type": "backend_test"},
        }
        for token in hedefler
        if token.get("expo_push_token")
    ]

    try:
        gonderilen, expo_responses = send_expo_messages(mesajlar)
        delivery = process_expo_push_delivery(mesajlar, expo_responses)
        bildirim_log_kaydet(
            gonderilen,
            0,
            status="sent",
            reason="test_notification",
            token_count=len(hedefler),
            candidate_count=len(mesajlar),
            details=delivery,
        )
        print(f"{gonderilen} test bildirimi Expo Push API'ye gonderildi")
    except Exception as hata:
        bildirim_log_kaydet(0, 0, status="error", reason="test_notification", token_count=len(hedefler), error_message=str(hata))
        print(f"Test bildirimi gonderilemedi: {hata}")


def beklenen_degisim_bugun_gonderildi_mi(signal_date, fuel):
    dedupe_key = expected_change_dedupe_key(signal_date, fuel)

    try:
        sonuc = (
            supabase.table("notification_logs")
            .select("id")
            .eq("reason", "expected_change")
            .contains("details", {"dedupe_key": dedupe_key})
            .limit(1)
            .execute()
        )
    except Exception as hata:
        print(f"Beklenen degisim bildirim logu okunamadi: {hata}")
        return False

    return bool(sonuc.data)


def beklenen_degisim_degisimi_olustur(signal_entry, signal_date):
    amount = float(signal_entry.get("expected_amount_tl") or signal_entry.get("expected_amount") or 0)

    return {
        "city": "Turkiye geneli",
        "fuel": signal_entry.get("fuel", "Yakıt"),
        "field": None,
        "old_price": signal_entry.get("current_price"),
        "new_price": signal_entry.get("expected_price"),
        "diff": amount if signal_entry.get("direction") == "increase" else -amount,
        "direction": signal_entry.get("direction", "neutral"),
        "timing": signal_entry.get("timing"),
        "source": "expected_change",
        "signal_date": signal_date,
    }


def beklenen_degisim_bildirimleri_gonder(market_row):
    disable_stale_tokens(supabase)
    if istanbul_quiet_hours_active(datetime.now(ISTANBUL_TZ)):
        bildirim_log_kaydet(
            0,
            0,
            status="skipped",
            reason="expected_change_quiet_hours",
            details={"signal_date": market_row.get("signal_date")},
        )
        return

    signal_date = market_row.get("signal_date") or bugun_signal_tarihi()
    uygun_sinyaller = filter_expected_change_signals(market_row)

    if not uygun_sinyaller:
        return

    tokenlar = push_tokenlarini_oku()

    if not tokenlar:
        bildirim_log_kaydet(
            0,
            len(uygun_sinyaller),
            status="skipped",
            reason="expected_change_no_tokens",
            details={"signal_date": signal_date},
        )
        return

    toplam_gonderilen = 0

    for signal_entry in uygun_sinyaller:
        fuel = signal_entry.get("fuel", "Yakıt")

        if beklenen_degisim_bugun_gonderildi_mi(signal_date, fuel):
            continue

        degisim = beklenen_degisim_degisimi_olustur(signal_entry, signal_date)
        dedupe_key = expected_change_dedupe_key(signal_date, fuel)
        mesajlar = []
        skipped_quiet_count = 0
        skipped_empty_token_count = 0
        skipped_no_match_count = 0

        for token_kayit in tokenlar:
            if sessiz_saatte_mi(token_kayit):
                skipped_quiet_count += 1
                continue

            if not token_kayit.get("expo_push_token"):
                skipped_empty_token_count += 1
                continue

            tracked = liste_degeri(token_kayit.get("tracked_fuels"))

            if not fuel_matches_tracked(fuel, tracked):
                skipped_no_match_count += 1
                continue

            secilen = token_icin_degisim_sec(token_kayit, [degisim])

            if not secilen:
                skipped_no_match_count += 1
                continue

            mesajlar.append(bildirim_mesaji_olustur(token_kayit, secilen))

        if not mesajlar:
            bildirim_log_kaydet(
                0,
                1,
                status="skipped",
                reason="expected_change_no_matching_devices",
                token_count=len(tokenlar),
                skipped_quiet_count=skipped_quiet_count,
                skipped_empty_token_count=skipped_empty_token_count,
                skipped_no_match_count=skipped_no_match_count,
                details={"dedupe_key": dedupe_key, "fuel": fuel, "signal_date": signal_date},
            )
            continue

        gonderilen = 0
        expo_responses = []

        try:
            gonderilen, expo_responses = send_expo_messages(mesajlar)
            delivery = process_expo_push_delivery(mesajlar, expo_responses)
        except Exception as hata:
            bildirim_log_kaydet(
                gonderilen,
                1,
                status="error",
                reason="expected_change_expo_api_error",
                token_count=len(tokenlar),
                candidate_count=len(mesajlar),
                error_message=str(hata),
                details={"dedupe_key": dedupe_key, "fuel": fuel, "expo_responses": expo_responses},
            )
            continue

        bildirim_log_kaydet(
            gonderilen,
            1,
            status="sent",
            reason="expected_change",
            token_count=len(tokenlar),
            candidate_count=len(mesajlar),
            skipped_quiet_count=skipped_quiet_count,
            skipped_empty_token_count=skipped_empty_token_count,
            skipped_no_match_count=skipped_no_match_count,
            details={
                "dedupe_key": dedupe_key,
                "fuel": fuel,
                "signal_date": signal_date,
                "signal": signal_entry,
                **delivery,
            },
        )
        toplam_gonderilen += gonderilen
        print(f"Beklenen degisim bildirimi gonderildi: {fuel} ({gonderilen} cihaz)")

    if toplam_gonderilen:
        print(f"Toplam {toplam_gonderilen} beklenen degisim push bildirimi gonderildi")


def fiyat_bildirimleri_gonder(degisimler, price_memory=None):
    disable_stale_tokens(supabase)
    notification_reason = None
    signal_date = bugun_signal_tarihi()
    bekleyen_kayitlar = []
    bekleyen_dedupe_keys = []

    degisimler = list(degisimler or [])

    if istanbul_quiet_hours_active(datetime.now(ISTANBUL_TZ)):
        if degisimler:
            pending_fiyat_degisimleri_kaydet(degisimler)
        degisimler = []
    else:
        bekleyen_kayitlar = bekleyen_fiyat_degisimlerini_oku()
        bekleyen_dedupe_keys = [kayit["dedupe_key"] for kayit in bekleyen_kayitlar]
        bekleyen_degisimler = [kayit["change_payload"] for kayit in bekleyen_kayitlar]
        degisimler = dedupe_price_changes(bekleyen_degisimler + degisimler, signal_date)

        if bekleyen_degisimler:
            print(f"Sessiz saat kuyrugundan {len(bekleyen_degisimler)} bekleyen fiyat degisimi eklendi")

    if not degisimler:
        hafiza_degisimi = hafiza_degisimi_olustur(price_memory)

        if hafiza_degisimi and not gunluk_hafiza_bildirimi_gonderildi_mi():
            degisimler = hafiza_degisimi
            notification_reason = "price_memory"
            print("Anlik fiyat degisimi yok, gunluk pompa hafizasi bildirimi deneniyor")
        else:
            reason = "price_memory_already_sent" if hafiza_degisimi else "no_changes"
            print("Fiyat degisimi yok, bildirim gonderilmedi")
            bildirim_log_kaydet(
                0,
                0,
                status="skipped",
                reason=reason,
                details={"price_memory": price_memory or {}},
            )
            return

    if not degisimler:
        print("Fiyat degisimi yok, bildirim gonderilmedi")
        bildirim_log_kaydet(0, 0, status="skipped", reason="no_changes")
        return

    print(f"Bildirim icin {len(degisimler)} fiyat degisimi bulundu")
    for degisim in degisimler[:8]:
        if degisim.get("source") == "price_memory":
            print(
                "  Hafiza degisimi: "
                f"{degisim['city']} {degisim['fuel']} "
                f"({degisim['diff']:+.2f} TL)"
            )
        else:
            print(
                "  Degisim: "
                f"{degisim['city']} {degisim['fuel']} "
                f"{degisim['old_price']:.2f} -> {degisim['new_price']:.2f} "
                f"({degisim['diff']:+.2f} TL)"
            )

    tokenlar = push_tokenlarini_oku()

    if not tokenlar:
        print("Kayitli push token yok, bildirim gonderilmedi")
        bildirim_log_kaydet(
            0,
            len(degisimler),
            status="skipped",
            reason="no_tokens",
            details={
                "changes": degisim_ozeti(degisimler),
                "price_memory": price_memory or {},
                "trigger": notification_reason or "price_change",
            },
        )
        return

    mesajlar = []
    skipped_quiet_count = 0
    skipped_empty_token_count = 0
    skipped_no_match_count = 0

    for token_kayit in tokenlar:
        if sessiz_saatte_mi(token_kayit):
            skipped_quiet_count += 1
            continue

        if not token_kayit.get("expo_push_token"):
            skipped_empty_token_count += 1
            continue

        degisim = token_icin_degisim_sec(token_kayit, degisimler)

        if not degisim:
            skipped_no_match_count += 1
            continue

        mesajlar.append(bildirim_mesaji_olustur(token_kayit, degisim))

    if not mesajlar:
        print("Bildirim kosullarina uyan cihaz yok")
        bildirim_log_kaydet(
            0,
            len(degisimler),
            status="skipped",
            reason="no_matching_devices",
            token_count=len(tokenlar),
            skipped_quiet_count=skipped_quiet_count,
            skipped_empty_token_count=skipped_empty_token_count,
            skipped_no_match_count=skipped_no_match_count,
            details={
                "changes": degisim_ozeti(degisimler),
                "price_memory": price_memory or {},
                "trigger": notification_reason or "price_change",
            },
        )
        return

    gonderilen = 0
    expo_responses = []

    try:
        gonderilen, expo_responses = send_expo_messages(mesajlar)
        delivery = process_expo_push_delivery(mesajlar, expo_responses)
    except Exception as hata:
        print(f"Expo Push API bildirimi gonderemedi: {hata}")
        bildirim_log_kaydet(
            gonderilen,
            len(degisimler),
            status="error",
            reason="expo_api_error",
            token_count=len(tokenlar),
            candidate_count=len(mesajlar),
            skipped_quiet_count=skipped_quiet_count,
            skipped_empty_token_count=skipped_empty_token_count,
            skipped_no_match_count=skipped_no_match_count,
            error_message=str(hata),
            details={
                "changes": degisim_ozeti(degisimler),
                "expo_responses": expo_responses,
                "price_memory": price_memory or {},
                "trigger": notification_reason or "price_change",
            },
        )
        return

    if bekleyen_dedupe_keys:
        bekleyen_fiyat_degisimlerini_gonderildi_isaretle(bekleyen_dedupe_keys)

    bildirim_log_kaydet(
        gonderilen,
        len(degisimler),
        status="sent",
        reason=notification_reason or ("pending_quiet_hours_flush" if bekleyen_dedupe_keys else None),
        token_count=len(tokenlar),
        candidate_count=len(mesajlar),
        skipped_quiet_count=skipped_quiet_count,
        skipped_empty_token_count=skipped_empty_token_count,
        skipped_no_match_count=skipped_no_match_count,
        details={
            "changes": degisim_ozeti(degisimler),
            "price_memory": price_memory or {},
            "trigger": notification_reason or "price_change",
            "flushed_pending_keys": bekleyen_dedupe_keys,
            **delivery,
        },
    )
    print(f"{gonderilen} push bildirimi Expo Push API'ye gonderildi")


if __name__ == "__main__":
    print(f"Fiyatlar cekiliyor... {datetime.now(ISTANBUL_TZ).strftime('%d/%m/%Y %H:%M')}\n")

    onceki_fiyatlar = mevcut_fiyatlari_oku()
    veri = None
    scraping_basarili = False

    try:
        veri = tum_fiyatlari_cek()
        scraping_basarili = True
    except Exception as hata:
        print(f"UYARI: Akaryakit scraping sirasinda hata olustu: {hata}")
        if onceki_fiyatlar and len(onceki_fiyatlar) >= 50:
            print("Supabase'deki mevcut fiyat kayitlari yedek veri olarak kullaniliyor...")
            veri = onceki_fiyatlar
        else:
            raise

    degisimler = fiyat_degisimlerini_hesapla(onceki_fiyatlar, veri) if scraping_basarili else []
    klasor = os.path.dirname(os.path.abspath(__file__))

    if scraping_basarili:
        with open(os.path.join(klasor, "fiyatlar.json"), "w", encoding="utf-8") as f:
            json.dump(veri, f, ensure_ascii=False, indent=2)

        for il in sorted(veri.keys()):
            print(f"  {il}: {veri[il]['benzin_95']}")

        try:
            assert_bulk_price_deviation_ok(onceki_fiyatlar, veri)
        except PriceSanityError as hata:
            print(hata)
            raise SystemExit(1) from hata

        fiyat_degisim_gecmisi_kaydet(degisimler)
        supabase_yaz(veri)
        gecmis_kaydet(veri)
    elif veri is not None:
        gecmis_kaydet(veri)
    onceki_pompa_hafizasi = gunluk_pompa_hafizasi_oku()

    try:
        sinyal = piyasa_sinyali_kaydet(degisimler, onceki_pompa_hafizasi)
    except Exception as hata:
        print("Piyasa sinyali Supabase'e kaydedilemedi. backend/supabase_market_signals.sql dosyasini kontrol edin.")
        print(f"Detay: {hata}")
        raise SystemExit(1) from hata

    price_memory = (sinyal or {}).get("analysis", {})
    fiyat_bildirimleri_gonder(
        degisimler,
        {
            "score": price_memory.get("price_score", 0),
            "direction": price_memory.get("price_direction", "neutral"),
            "summary": price_memory.get("price_summary"),
            "items": price_memory.get("price_items", []),
            "remembered_at": price_memory.get("price_memory", {}).get("remembered_at"),
        },
    )

    beklenen_degisim_bildirimleri_gonder(sinyal or {})

    if os.getenv("SEND_TEST_NOTIFICATION", "").lower() == "true":
        test_bildirimi_gonder(os.getenv("TEST_NOTIFICATION_INSTALLATION_ID", ""))
