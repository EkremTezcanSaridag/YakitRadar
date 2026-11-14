# Yakıt Radar

Türkiye genelinde **benzin, motorin ve LPG** pompa fiyatlarını takip etmek için geliştirilen **Expo (React Native)** mobil uygulama ve **Python** backend deposudur. Veriler Supabase üzerinde tutulur; fiyat güncelleme ve push bildirimleri GitHub Actions ile zamanlanır.

## Ne yapar?

- 81 il için güncel pompa fiyatları (kaynak: Aytemiz sayfaları, backend scraper)
- Ulusal ortalama, il karşılaştırması, geçmiş grafikleri
- Haber ve makro verilerle **piyasa sinyali** (yön, güven, beklenen tutar tahmini — Groq ile analiz)
- Fiyat değişiminde **push bildirim** (Expo), sessiz saat kuyruğu, beklenen değişim bildirimleri
- **Bayat veri uyarısı:** kaynak verisi 24 saatten eskiyse banner, rozet ve tasarruf tahmini gizleme
- Araç gideri / yakıt fişi kaydı (yerel)
- İsteğe bağlı reklam (AdMob) ve gizlilik sayfaları

## Sürüm 1.0.17 (özet)

**Veri hattı (Sprint 1–3)**

- Yakıt bazlı fiyat koruması: benzin/motorin %10, **LPG %25** sapma eşiği; anormal yakıt eski değerde kalır, diğerleri yazılır.
- Günlük `gecmis` değişim limitleri yakıt bazlı (LPG 12 TL) ve `PRICE_SANITY_OVERRIDE` ile elle aşılabilir.
- Scraper başarısızsa `gecmis`'e düz satır yazılmaz; veri sağlık issue'su açılır, başarılı koşuda otomatik kapanır.
- LPG büyük değişimlerinde bildirim üretilir; mükerrer bildirim ve sessiz saat kuyruğu testlerle korunur.

**Mobil (Sprint 4)**

- Ana Sayfa ve İller ekranlarında `Kaynak güncelleme: 12 Kas 2026 08:05` satırı.
- 24 saatten eski veride `Fiyatlar 24 saatten eski · Kaynak: …` banner'ı ve `Bayat veri` rozeti.
- Bayat veride tasarruf tahmini gizlenir; beklenen değişim tutarları görünür kalır.
- Offline cache zamanı ile kaynak verisinin yaşı ayrı gösterilir.

**Bakım**

- 25 backend test dosyası, 16 mobil script testi.
- Operasyon runbook'u ve refactor planı: [`docs/OPERATIONS.md`](docs/OPERATIONS.md), [`docs/REFACTOR_PLAN.md`](docs/REFACTOR_PLAN.md).

## Ekran görüntüleri

Görseller ayrı PR ile eklenecek:

| Ekran | Dosya |
|--------|--------|
| İller | `docs/screenshots/iller.png` |
| Bildirimler | `docs/screenshots/bildirimler.png` |

## Mobil ekranlar

| Ekran | İçerik |
|--------|--------|
| **Ana Sayfa** | Seçili il fiyatı, yakıt türü, ulusal ortalama, piyasa sinyali / beklenen değişim, kaynak güncelleme saati, yenileme |
| **İller** | 81 il listesi, arama, yakıt filtresi, kaynak güncelleme saati |
| **Geçmiş** | 7 / 30 / 90 gün trend, `gecmis` tablosundan günlük değişimler |
| **Aracım** | Araç profili, yakıt fişi, gider özeti |
| **Bildirimler** | Push izni, fiyat alarmları, uyarı tercihleri, sessiz saat, test bildirimi, gizlilik politikası ve Hakkında bağlantısı |

## Mimari

```
[Aytemiz web] ← Python fiyat_servisi.py ← GitHub Actions (guncelle.yml)
                        ↓
                  [Supabase: fiyatlar, gecmis, market_signals, push_tokens, …]
                        ↓
              [Expo mobil uygulama — anon Supabase okuma + register_push_token RPC]
```

### Backend (Python)

- `fiyat_servisi.py` — scrape, önceki fiyatla diff, yakıt bazlı sapma koruması (`price_scrape_guard`), `gecmis` yazımı, piyasa sinyali, push
- `price_scrape_guard.py` — alan bazlı sapma politikaları, kısmi blok, günlük değişim limitleri
- `market_signals.py` — haber, TCMB kuru, Groq analizi, mobil sinyal alanları
- `notification_rules.py` — sessiz saat (22:00–08:00 İstanbul), beklenen değişim uygunluk kuralları
- `schedule_freshness.py` — zamanlanmış koşuda veri taze ise scraper atlama (sabah `10 5 * * *` UTC koşusu hariç)

### Zamanlama (`guncelle.yml`)

- Cron: `7,27,47 * * * *` UTC + sabah `10 5 * * *` (sessiz saat kuyruğu / beklenen değişim)
- Taze veri kapısı: son `fiyatlar.guncelleme` ≤ ~45 dk ise hafif gate (scraper atlanabilir; kuyruk flush ayrı adım)
- `workflow_dispatch` ve `main` push: tam koşu
- Başarısız planlı koşularda issue uyarısı; başarılı koşuda otomatik kapanış (GITHUB_TOKEN)
- Acil durum: `workflow_dispatch` → `price_sanity_override=true` (yalnızca elle tetikleme)

### Bildirim mantığı (özet)

1. Scrape sonrası `fiyatlar` ile karşılaştırma → şehir bazlı diff (benzin/motorin 8 TL, **LPG 12 TL** üzeri bildirimden düşer).
2. Sessiz saatte diff → `pending_price_notifications`; 08:00 sonrası ilk uygun koşuda birleştirilip push.
3. `market_signals` içindeki uygun sinyaller → “beklenen artış/indirim” push (güven ≥ medium, günde yakıt bazında tek).
4. Token kaydı: mobil `register_push_token` RPC; backend `push_tokens.enabled` ve tercih alanları.

## APK alma

Önizleme APK üretimi: `.github/workflows/eas-preview-build.yml` (EAS, `preview` profili → `apk`). Üretim: `production` profili → `app-bundle` (Play Store).

1. GitHub → **Actions** → **EAS Android Preview APK** → **Run workflow**.
2. `ref` alanına branch adı (`main` veya test branch'i) yazın.
3. Gerekli secret: `EXPO_TOKEN` (Expo → Access tokens). EAS proje kimliği `app.json` içinde tanımlı.
4. Build bitince EAS artifact bağlantısı workflow özetinde görünür.

Yerel geliştirme:

```bash
cd mobile
npm install
npm start
```

Yerel APK derlemesi (`npx expo run:android`) için JDK 17 + Android SDK gerekir; bu makinede JDK yok, `mobile/node_modules` da kurulu değil. Bu yüzden önerilen yol **EAS cloud build**. Ayrıntılar: [`PLAY_STORE_HAZIRLIK.md`](PLAY_STORE_HAZIRLIK.md), [`mobile/docs/ads-eas-env.md`](mobile/docs/ads-eas-env.md).

## Ortam değişkenleri (yalnızca adlar)

### Mobil (Expo public)

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL` (opsiyonel; Bildirimler ekranındaki gizlilik bağlantısı)
- `EXPO_PUBLIC_SKIP_PRICE_EVENTS` (opsiyonel, legacy)

### Backend / Actions secrets

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `SEND_TEST_NOTIFICATION`
- `TEST_NOTIFICATION_INSTALLATION_ID`
- `MAX_REASONABLE_PRICE_CHANGE` (opsiyonel, benzin/motorin)
- `MAX_REASONABLE_LPG_CHANGE` (opsiyonel, varsayılan 12.0)
- `NOTIFICATION_MIN_CHANGE` (opsiyonel)
- `EXPO_TOKEN` (EAS build)
- AdMob: `EXPO_PUBLIC_ADMOB_*` (EAS — bkz. `mobile/docs/ads-eas-env.md`)

## Kurulum

```bash
# Mobil
cd mobile && npm install && npm start

# Backend (yerel tek koşu)
cd backend && pip install -r requirements.txt && python fiyat_servisi.py

# Backend testler
cd backend && pip install -r requirements-dev.txt && pytest
```

Supabase SQL dosyaları (`backend/supabase_*.sql`) operatör tarafından SQL Editor'da uygulanır; repoda migration otomatik çalışmaz. Uygulama sırası: [`docs/OPERATIONS.md`](docs/OPERATIONS.md#6-supabase-sql-uygulama-sırası).

## Testler

| Alan | Komut |
|------|--------|
| Backend (tümü) | `cd backend && pytest` |
| Fiyat guard | `pytest tests/test_price_scrape_guard.py` |
| Bildirim hattı | `pytest tests/test_notification_pipeline.py` |
| Veri sağlığı çıktıları | `pytest tests/test_data_health_outputs.py` |
| Mobil tazelik | `cd mobile && npm run test:fuel-data-freshness` |
| Mobil offline fuel | `cd mobile && npm run test:fuel-data-offline` |
| İller filtre çipleri | `cd mobile && npm run test:iller-filter-chip` |
| Gizlilik bağlantısı | `cd mobile && npm run test:privacy-links` |

CI: `backend-tests.yml`, `mobile-check.yml` (script testleri + Android bundle export).

## Gizlilik ve mağaza

- Gizlilik politikası: [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md)
- Web sürümü (GitHub Pages): [`docs/index.html`](docs/index.html)
- Play Data safety özeti: [`docs/data-safety.md`](docs/data-safety.md)
- Mağaza kontrol listesi: [`PLAY_STORE_HAZIRLIK.md`](PLAY_STORE_HAZIRLIK.md)
- Play Store yayın adımları: [`docs/PLAY_RELEASE_CHECKLIST.md`](docs/PLAY_RELEASE_CHECKLIST.md)
- Güvenlik, APK doğrulama ve antivirüs yanlış pozitifleri: [`SECURITY.md`](SECURITY.md)

## Operasyon

- Günlük sağlık kontrolü, manuel güncelleme, guard triyajı, SQL sırası ve rollback: [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- Zamanlama ve Actions bütçesi: [`docs/scheduled-price-refresh.md`](docs/scheduled-price-refresh.md)
- Mobil yenileme tetikleyicisi: [`docs/edge-refresh.md`](docs/edge-refresh.md)
- Sprint geçmişi: [`docs/SPRINT_PLAN.md`](docs/SPRINT_PLAN.md)
- Refactor planı: [`docs/REFACTOR_PLAN.md`](docs/REFACTOR_PLAN.md)

## Bilinen eksikler / sınırlar

- `price_change_events` tablosu her ortamda yok; mobil son değişimler için `gecmis` kullanıyor.
- Expo push **receipt** / teslim doğrulama ve stale token temizliği geliştirme aşamasında (ayrı PR).
- Kullanıcı hesabı yok; push `installation_id` ile cihaz bazlı.
- İstasyon bazlı fiyat yok; il ortalamaları / pompa listesi kaynağına bağlı.
- Groq / haber analizi hata verirse kural tabanlı sinyale düşülür.
- Mağaza yayını için imzalı AAB ve gizlilik URL'si operatör adımı gerektirir.

## Veri kaynağı

Akaryakıt: Aytemiz resmi fiyat sayfaları. Makro: TCMB kurları. Haber: RSS / kaynak modülü. Analiz: Groq (yapılandırıldığında).

## Lisans

Bu depo **tescilli** yazılımdır; detaylar için kök dizindeki [LICENSE](LICENSE) dosyasına bakın. Özet: kaynak kod yalnızca görüntüleme amaçlıdır; yazılı izin olmadan kopyalama, değiştirme, dağıtım, ticari kullanım ve türev uygulama yayınlama yasaktır. Mobil paket `license` alanı: `UNLICENSED`.

## Katkı

Öneri ve hata bildirimi issue / PR ile iletilebilir; telif ve kullanım koşulları LICENSE metninde tanımlıdır.
