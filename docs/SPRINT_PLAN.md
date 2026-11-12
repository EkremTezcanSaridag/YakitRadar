# Yakıt Radar — Sprint Planı

**Tarih:** 12 Kasım 2026  
**Hedef:** Veri hattını kesintisiz, gözlemlenebilir ve güvenli hale getirmek; mobil uygulamada her zaman taze veri göstermek.

---

## Sprint 0 — Teşhis (tamamlandı)

- `Günlük Fiyat Güncelleme` workflow'u 7 Kasım 2026 00:20'den beri her koşuda düşüyor.
- `fiyatlar` tablosundaki son gerçek yazma: **31 Ekim 2026 22:23**.
- Kök neden: LPG fiyatları kaynakta 41,7 TL → ~51,0 TL'ye çıktı (~%22,5). `price_scrape_guard` %10 eşiği ve şehirlerin %100'ü sapınca tüm yazmayı iptal ediyor.
- İkinci tuzak: `validate_gecmis_daily_deltas` 8 TL/gün limiti LPG'deki 9,3 TL farkı reddediyor; `price_sanity_override` bu kontrolü kapsamıyor.
- Benzin/motorin sapması yok; sorun izole olarak LPG kaynaklı.

---

## Sprint 1 — P0: Veri hattını aç, guard'ı alan bazlı yap

**Amaç:** Tek bir yakıttaki gerçek/anormal değişim tüm güncellemeyi kilitlemesin; hat tekrar aksın.

- [x] Guard'ı yakıt bazlı politikalara ayır:
  - Benzin / Motorin: %10 sapma, şehirlerin %50'si
  - LPG: %25 sapma, şehirlerin %50'si
- [x] Anormal yakıtı **eski değerde tut**, diğer yakıtları yaz (kısmi blok).
- [x] Üç yakıt da anormalse koşuyu düşür (gerçek olay sinyali).
- [x] `MAX_REASONABLE_PRICE_CHANGE` eşiğini yakıt bazlı yap (LPG için 12 TL).
- [x] `validate_gecmis_daily_deltas` `PRICE_SANITY_OVERRIDE`'a saygı duysun.
- [x] Uyarıları `::warning::` ve GitHub Step Summary ile görünür yap.
- [x] Testler: LPG %22,5 kabul; benzin ayrışınca sadece benzin blok; override; LPG 9,3 TL günlük fark kabul.
- [x] Acil durum için manuel override koşusu (kod tarafı hazır; `workflow_dispatch` → `price_sanity_override=true`; adımlar [`OPERATIONS.md`](OPERATIONS.md#3-guard-alarmı-tiryajı)).

**Kabul kriteri:** Workflow yeşil, `fiyatlar` güncelleniyor, LPG 51 TL'ye geçiyor, benzin/motorin akmaya devam ediyor, testler geçiyor.

---

## Sprint 2 — P1: Veri kalitesi ve gözlemlenebilirlik

- [x] Scraper başarısızken `gecmis`'e aynı ortalamayı "0,00 değişim"le yazmayı durdur; yalnızca gerçek scrape gününde yaz.
- [x] Guard bloklarını workflow özetinde ve issue/uyarı olarak görünür yap (step output + `Fiyat güncelleme sağlık uyarısı` issue).
- [x] Freshness gate tanısı: `gate_event_name` / `gate_schedule` logları eklendi. 13:43 `gate=false` bulgusu gecikmiş sabah koşusu; sabah 05:10 UTC koşusu bilinçli olarak gate'siz.
- [x] Başarılı koşuda `Scheduled guncelle workflow failed` ve veri sağlık issue'larını otomatik kapat.
- [x] Scraper hata mesajlarına kaynak HTTP durumu + eşleşen il sayısı ekle (`log_scrape_failure_summary` zaten `http_status` ve `match_count` yazıyor; testlerle korunuyor).

**Kabul kriteri:** Başarısız scrape geçmiş grafiğini bozmuyor; guard blokları run özetinde görünüyor.

---

## Sprint 3 — P1: Bildirim doğruluğu

- [x] LPG büyük değişimlerinde bildirim üret (yakıt bazlı eşik: benzin/motorin 8 TL, LPG 12 TL).
- [x] Aynı gün/aynı fiyat için tekrar bildirim engelini test et (kuyruk + taze scrape aynı değişimi tek bildirime indiriyor; ikinci koşu tekrar göndermiyor).
- [x] Sessiz saat kuyruğu ve 08:00 flush akışını uçtan uca test et (kuyruğa yazma → sabah tek gönderim → gönderildi işaretleme; hatalı gönderimde kuyruk korunuyor).
- [x] `MAX_REASONABLE_PRICE_CHANGE` nedeniyle sessizce düşen bildirimleri logla (`::warning::` + limit ve toplam sayaç).

**Kabul kriteri:** LPG 9,3 TL artışında tek bildirim gidiyor; mükerrer bildirim yok.

**Ek (test sağlığı):** `test_market_signal_storage` yanlış hedefi (`market_signals.build_market_signal`) mock'luyordu; gerçek ağ çağrısı yapıp suite'i dakikalarca bekletiyordu. `fiyat_servisi.build_market_signal` olarak düzeltildi — tam suite 192 sn'den ~6 sn'ye indi.

---

## Sprint 4 — P2: Mobil tazelik UX

- [x] "Son güncelleme" yaşına göre banner: kaynak verisi 24 saatten eskiyse belirgin uyarı (`Fiyatlar 24 saatten eski · Kaynak: …`).
- [x] Ana Sayfa ve İller ekranlarında kaynak güncelleme tarihini göster (`Kaynak güncelleme: 12 Kas 2026 08:05`).
- [x] Offline cache ile bayat veriyi ayırt et (offline banner cache saatini, kaynak satırı bayatlığı ayrı gösteriyor).
- [x] Bayat veri durumunda tasarruf kartlarını işaretle: `Bayat veri` rozeti + tasarruf tahmini gizleniyor.

**Kabul kriteri:** Kullanıcı bayat veriyle taze veriyi karıştırmıyor.

---

## Sprint 5 — P2: Bakım ve dokümantasyon

- [x] README sürümünü 1.0.17'ye, AUDIT.md'yi güncel duruma çek.
- [x] PR #34'ü gözden geçir: branch 16 Ekim'den beri `main`'in 83 dosya gerisinde ve #53 (Play Store + feragat) ile çakışıyor. Tekil değeri olan gizlilik dokümanları ve uygulama içi bağlantı bu dala taşındı; PR operatör tarafından kapatılabilir.
- [x] Operasyon runbook: manuel override, guard alarmı, Supabase SQL uygulama sırası → [`OPERATIONS.md`](OPERATIONS.md).
- [x] Büyük dosyalar için refactor planı: `Aracim.js`, `Bildirimler.js`, `fuelData.js`, `market_signals.py`, `fiyat_servisi.py` → [`REFACTOR_PLAN.md`](REFACTOR_PLAN.md).

**Ek (PR #34 taşıması):** Gizlilik politikası güncellendi (kurulum kimliği, saklama, silme hakları, AdMob/UMP, konum), `docs/index.html` (GitHub Pages), `docs/data-safety.md`, `mobile/src/config/publicLinks.js` ve Bildirimler ekranında `EXPO_PUBLIC_PRIVACY_POLICY_URL` bağlantısı eklendi. Sourcery'nin işaret ettiği geocoder aktarımı açıkça belirtildi.

**Kabul kriteri:** Yeni gelen operatör tek belgeden hattı izleyip müdahale edebiliyor; README güncel sürümü ve bağlantıları gösteriyor.

---

## Çalışma kuralları

- Her sprint kendi branch'inde: `fix/sprint-N-...`
- Her değişiklikte ilgili backend/mobil testleri çalıştır.
- P0 sprint'i tamamlanmadan yeni özellik eklenmez.
- GitHub Actions tetikleme/push yetkisi operatörde; kod hazır olduğunda PR açılır.
