# Refactor Planı — Büyük Dosyalar

Bu plan, davranış değiştirmeden bakım maliyetini düşürmeyi hedefler. Her adım ayrı PR, her PR'da mevcut testler yeşil kalmalı. Refactor sırasında **özellik eklenmez**.

**Ölçüm (13 Kasım 2026):**

| Dosya | Satır | Risk | Öncelik |
|-------|-------|------|---------|
| `backend/market_signals.py` | 1542 | Yüksek (ağ + analiz + karar aynı dosyada) | P1 |
| `mobile/src/services/fuelData.js` | 1527 | Yüksek (tek modülde fetch + normalize + görünüm) | P1 |
| `backend/fiyat_servisi.py` | 1347 | Yüksek (scrape + yazma + bildirim) | P1 |
| `mobile/src/screens/Bildirimler.js` | 1148 | Orta (tek ekran, çok state) | P2 |
| `mobile/src/screens/Iller.js` | 898 | Orta | P2 |
| `mobile/src/screens/Aracim.js` | 625 | Düşük | P3 |
| `backend/groq_market_analysis.py` | 1347 | Orta | P2 |

---

## 1. `market_signals.py` → 4 modül (P1)

**Mevcut karışım:** RSS çekme, TCMB/Brent serileri, haber skorlama, Groq çağrısı, sinyal üretimi, Supabase satır hazırlığı.

**Hedef yapı:**

```
backend/market/
  __init__.py          # dışa açılan API: build_market_signal, prepare_market_signal_row
  sources.py           # BRENT_SOURCES, NEWS_FEEDS, fetch_brent_history, fetch_usd_try_*
  news.py              # fetch_news_items, clean_news_text, score_news_items, keyword listeleri
  analysis.py          # resolve_* , build_fuel_signals, build_summary, build_analysis_factors
  groq.py              # prompt, request, response parse (groq_market_analysis.py ile birleştir)
  signal.py            # build_market_signal, expected_amounts_*, prepare_market_signal_row
```

**Adımlar:**
1. Saf fonksiyonları (`parse_float`, `percent_change`, `clamp`, `normalize_text`, `extract_news_price_mentions`) `market/utils.py`'ye taşı; `market_signals` içinde import ile geriye dönük uyum sağla.
2. `sources.py` + `news.py` ayrımı; ağ çağrıları enjekte edilebilir olsun (`fetch=...`) ki testler `requests` mock'lamasın.
3. `groq.py`'yi `groq_market_analysis.py` ile birleştir; tek `call_groq_analysis` giriş noktası kalsın.
4. `build_market_signal` yalnızca orkestrasyon yapsın (kaynak → skor → sinyal).
5. `market_signals.py` en fazla ~80 satırlık uyumluluk shim'i olarak kalsın; sonraki PR'da kaldır.

**Testler:** Mevcut `test_market_signals*.py`, `test_groq_payload_limits.py`, `test_tcmb_weekend_fallback.py` dosyaları taşınan modüllere yönlendirilir. Yeni: `sources` için HTTP hata/timeout, `news` için engelli kaynak filtresi.

**Risk azaltma:** Tek PR'da tüm dosyayı bölmeyin; her modül ayrı PR. Taşıma sırasında fonksiyon gövdeleri değişmez, yalnızca konum ve import değişir.

---

## 2. `fuelData.js` → veri / görünüm / format ayrımı (P1)

**Mevcut karışım:** Supabase okuma, cache, normalizasyon, tarih/para formatlama, sinyal türetme, grafik serileri, boş durum.

**Hedef yapı:**

```
mobile/src/services/fuel/
  client.js        # supabase sorguları, timeout, refreshMarketSignalFromRemote
  cache.js         # fuelDataCacheIO + fuelDataPersistence sarmalayıcı
  normalize.js     # normalizePriceRecord, normalizeHistoryRecord, deduplicateHistoryRecords
  format.js        # formatCurrency, formatShortDate, parseGuncellemeIstanbul, ...
  signals.js       # buildDetailedFuelPredictions, buildLiveFuelSignals, tone config
  view.js          # buildCityRows, buildHomeFuels, buildHistoryView, buildRecentChanges
  index.js         # loadFuelData, buildFuelData, emptyFuelData (dışa açılan API)
```

`mobile/src/services/fuelData.js` yalnızca yeniden dışa aktarım yapar; ekranlar ve hook'lar import yolunu değiştirmez.

**Adımlar:**
1. `format.js` (saf, test edilebilir) — en düşük risk.
2. `normalize.js` + `view.js` (saf dönüşümler).
3. `signals.js`.
4. `client.js` + `cache.js` (yan etkili kısım) en son.
5. `index.js` shim'ini koruyup iç importları kademeli güncelle.

**Testler:** `fuel-data-offline.test.mjs` ve `fuel-data-freshness.test.mjs` genişletilir: normalize kenar durumları (eksik `lpg`, boş `il`), format saat dilimi, `buildHistoryView` dönem sınırları.

**Dikkat:** `buildSourceFreshness` ve `snapshotFuelPricesForCompare` şu an `fuelDataCheckMeta.js`'de; taşırken mobil tazelik davranışını bozmayın (Sprint 4 sözleşmesi).

---

## 3. `fiyat_servisi.py` → scrape / persist / notify (P1)

**Mevcut karışım:** Scraper, guard, Supabase yazımı, `gecmis`, piyasa sinyali, push kuyruğu, bildirim gönderimi, test bildirimi.

**Hedef yapı:**

```
backend/pipeline/
  scrape.py       # akaryakit/lpg/tum_fiyatlari_cek, istanbul_bolgelerini_birlestir
  guard.py        # price_scrape_guard çağrıları + data-health output'ları
  persist.py      # supabase_yaz, gecmis_kaydet, fiyat_degisim_gecmisi_kaydet
  market.py       # piyasa_sinyali_kaydet, market_signals upsert
  notify.py       # token okuma, pending kuyruk, Expo gönderimi, mesaj üretimi
  expected.py     # beklenen değişim bildirimleri
  main.py         # fiyat_servisi.py giriş noktası; sadece akış
```

**Adımlar:**
1. `notify.py` ayrımı: `push_tokenlarini_oku` → `bekleyen_*` → `bildirim_mesaji_olustur` → `process_expo_push_delivery`. Sprint 3 testleri bu modüle taşınır.
2. `persist.py`: `gecmis_kaydet` ve `supabase_yaz`. "Scrape başarısızsa `gecmis` yazma" kuralı burada tek yerde korunur.
3. `scrape.py`: ağ çağrıları; `log_scrape_failure_summary` ile birlikte.
4. `guard.py`: Sprint 1 politikaları; `FIELD_DEVIATION_RATIOS` tek kaynak.
5. `main.py`: yalnızca sıra: scrape → guard → persist → market → notify.

**Testler:** `test_price_scrape_guard.py`, `test_notification_pipeline.py`, `test_data_health_outputs.py`, `test_pending_notification_flush.py` taşınan modüllere yönlendirilir. Yeni: `persist` için "scrape fail → no gecmis" birim testi.

**Risk:** Workflow `python backend/fiyat_servisi.py` çağırıyor; giriş noktası adı **değişmeyecek**.

---

## 4. `Bildirimler.js` → ekran + alt bileşenler (P2)

- `components/notifications/NotificationPermissionCard.js` — izin durumu, test bildirimi.
- `components/notifications/QuietHoursPanel.js` — sessiz saat anahtarı + 22:00–08:00 çipleri.
- `components/notifications/CustomAlertList.js` — alarm listesi, silme, toggle.
- `components/notifications/NewAlertModal.js` — modal formu ve doğrulama.
- `screens/Bildirimler.js` — yalnızca state orkestrasyonu ve yerleşim (~350 satır hedef).

**Test:** `scripts/iller-filter-chip.test.mjs` benzeri saf mantık testleri; modal doğrulaması ayrı fonksiyona çıkarılıp test edilir.

---

## 5. `Aracim.js` → form + özet bileşenleri (P3)

- `components/vehicle/VehicleProfileForm.js`
- `components/vehicle/FuelReceiptForm.js`
- `components/vehicle/ExpenseSummary.js`
- `services/vehicleExpense.js` — `buildMonthlyExpenses`, `toNumber`, `formatNumber` (şu an ekran içinde).

**Test:** `buildMonthlyExpenses` için saf birim testi (ay sınırı, boş geçmiş, eksik fiyat).

---

## 6. `Iller.js` → liste + filtre (P2)

- `components/cities/CityFilterChips.js` (mevcut `illerFilterChip*` stilleriyle)
- `components/cities/CityRow.js`
- `services/cityList.js` — arama, favori filtresi, ortalama farkı hesabı.

**Test:** Arama normalizasyonu (Türkçe İ/ı), favori filtresi, boş sonuç.

---

## Uygulama sırası ve kurallar

1. **P1:** `fuelData.js` (format → normalize → view), sonra `fiyat_servisi.py` (notify → persist), sonra `market_signals.py` (utils → news → sources).
2. Her PR: taşıma + import güncellemesi + test yönlendirmesi. Davranış değişikliği ayrı PR.
3. Her PR'da `pytest -q` ve ilgili mobil `node scripts/*.test.mjs` çalışır.
4. Ortak sabitler tek yerde: fiyat eşikleri `price_scrape_guard.py`, bildirim eşikleri `fiyat_servisi.py` (taşınınca `pipeline/notify.py`).
5. Refactor sırasında üretim hattı dondurulmaz; `main` her zaman çalışır durumda kalır.
