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
- [ ] Acil durum için manuel override koşusu (operatör adımı — kod tarafı hazır).

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

- [ ] LPG büyük değişimlerinde bildirim üret (yakıt bazlı eşik).
- [ ] Aynı gün/aynı fiyat için tekrar bildirim engelini test et.
- [ ] Sessiz saat kuyruğu ve 08:00 flush akışını uçtan uca test et.
- [ ] `MAX_REASONABLE_PRICE_CHANGE` nedeniyle sessizce düşen bildirimleri logla.

**Kabul kriteri:** LPG 9,3 TL artışında tek bildirim gidiyor; mükerrer bildirim yok.

---

## Sprint 4 — P2: Mobil tazelik UX

- [ ] "Son güncelleme" yaşına göre banner: 24 saatten eskiyse belirgin uyarı.
- [ ] Ana Sayfa ve İller ekranlarında kaynak güncelleme tarihini göster.
- [ ] Offline cache ile bayat veriyi ayırt et.
- [ ] Bayat veri durumunda fiyat karşılaştırma/tasarruf kartlarını gizle veya işaretle.

**Kabul kriteri:** Kullanıcı bayat veriyle taze veriyi karıştırmıyor.

---

## Sprint 5 — P2: Bakım ve dokümantasyon

- [ ] README sürümünü 1.0.17'ye, AUDIT.md'yi güncel duruma çek.
- [ ] PR #34'ü gözden geçir; #53 ile çakışıyorsa kapat.
- [ ] Operasyon runbook: manuel override, guard alarmı, Supabase SQL uygulama sırası.
- [ ] Büyük dosyalar için refactor planı: `Aracim.js`, `Bildirimler.js`, `fuelData.js`, `market_signals.py`.

---

## Çalışma kuralları

- Her sprint kendi branch'inde: `fix/sprint-N-...`
- Her değişiklikte ilgili backend/mobil testleri çalıştır.
- P0 sprint'i tamamlanmadan yeni özellik eklenmez.
- GitHub Actions tetikleme/push yetkisi operatörde; kod hazır olduğunda PR açılır.
