# Yakıt Radar

Türkiye genelinde **benzin, motorin ve LPG** pompa fiyatlarını takip etmek için geliştirilen **Expo (React Native)** mobil uygulama ve **Python** backend deposudur. Veriler Supabase üzerinde tutulur; fiyat güncelleme ve push bildirimleri GitHub Actions ile zamanlanır.

## Ne yapar?

- 81 il için güncel pompa fiyatları (kaynak: Aytemiz sayfaları, backend scraper)
- Ulusal ortalama, il karşılaştırması, geçmiş grafikleri
- Haber ve makro verilerle **piyasa sinyali** (yön, güven, beklenen tutar tahmini — Groq ile analiz)
- Fiyat değişiminde **push bildirim** (Expo), sessiz saat kuyruğu, beklenen değişim bildirimleri
- Araç gideri / yakıt fişi kaydı (yerel)
- İsteğe bağlı reklam (AdMob) ve gizlilik sayfaları

## Mobil ekranlar

| Ekran | İçerik |
|--------|--------|
| **Ana Sayfa** | Seçili il fiyatı, yakıt türü, ulusal ortalama, piyasa sinyali / beklenen değişim, yenileme |
| **İller** | 81 il listesi, arama, yakıt filtresi |
| **Geçmiş** | 7 / 30 / 90 gün trend, `gecmis` tablosundan günlük değişimler |
| **Aracım** | Araç profili, yakıt fişi, gider özeti |
| **Bildirimler** | Push izni, günlük / il bazlı uyarılar, sessiz saat, test bildirimi |

## Mimari

```
[Aytemiz web] ← Python fiyat_servisi.py ← GitHub Actions (guncelle.yml)
                        ↓
                  [Supabase: fiyatlar, gecmis, market_signals, push_tokens, …]
                        ↓
              [Expo mobil uygulama — anon Supabase okuma + register_push_token RPC]
```

### Backend (Python)

- `fiyat_servisi.py` — scrape, önceki fiyatla diff, bulk sapma koruması (`price_scrape_guard`), `gecmis` yazımı, piyasa sinyali, push
- `market_signals.py` — haber, TCMB kuru, Groq analizi, mobil sinyal alanları
- `notification_rules.py` — sessiz saat (22:00–08:00 İstanbul), beklenen değişim uygunluk kuralları
- `schedule_freshness.py` — zamanlanmış koşuda veri taze ise scraper atlama (sabah `10 5 * * *` UTC koşusu hariç)

### Zamanlama (`guncelle.yml`)

- Cron: `7,27,47 * * * *` UTC + sabah `10 5 * * *` (sessiz saat kuyruğu / beklenen değişim)
- Taze veri kapısı: son `fiyatlar.guncelleme` ≤ ~45 dk ise hafif gate (scraper atlanabilir; kuyruk flush ayrı adım)
- `workflow_dispatch` ve `main` push: tam koşu
- Başarısız planlı koşularda issue uyarısı (GITHUB_TOKEN)

### Bildirim mantığı (özet)

1. Scrape sonrası `fiyatlar` ile karşılaştırma → şehir bazlı diff (|fark| &gt; 8 TL bildirimden düşer).
2. Sessiz saatte diff → `pending_price_notifications`; 08:00 sonrası ilk uygun koşuda birleştirilip push.
3. `market_signals` içindeki uygun sinyaller → “beklenen artış/indirim” push (güven ≥ medium, günde yakıt bazında tek).
4. Token kaydı: mobil `register_push_token` RPC; backend `push_tokens.enabled` ve tercih alanları.

## APK alma

Önizleme APK üretimi: `.github/workflows/eas-preview-build.yml` (EAS). Yerel geliştirme:

```bash
cd mobile
npm install
npm start
```

Üretilmiş APK bağlantısı EAS artifact çıktısına bağlıdır; workflow dokümantasyonuna bakın.

## Ortam değişkenleri (yalnızca adlar)

### Mobil (Expo public)

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SKIP_PRICE_EVENTS` (opsiyonel, legacy)

### Backend / Actions secrets

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `SEND_TEST_NOTIFICATION`
- `TEST_NOTIFICATION_INSTALLATION_ID`
- `PRICE_SANITY_OVERRIDE` (opsiyonel)
- `MAX_REASONABLE_PRICE_CHANGE` (opsiyonel)
- `NOTIFICATION_MIN_CHANGE` (opsiyonel)
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

Supabase SQL dosyaları (`backend/supabase_*.sql`) operatör tarafından SQL Editor’da uygulanır; repoda migration otomatik çalışmaz.

## Testler

| Alan | Komut |
|------|--------|
| Backend | `cd backend && pytest` |
| Mobil offline fuel | `cd mobile && npm run test:fuel-data-offline` |
| Workflow YAML guard | `backend/tests/test_guncelle_workflow.py` |

CI: `backend-tests.yml`, `mobile-check.yml` (Android bundle export).

## Bilinen eksikler / sınırlar

- `price_change_events` tablosu her ortamda yok; mobil son değişimler için `gecmis` kullanıyor.
- Expo push **receipt** / teslim doğrulama ve stale token temizliği geliştirme aşamasında (ayrı PR).
- Kullanıcı hesabı yok; push `installation_id` ile cihaz bazlı.
- İstasyon bazlı fiyat yok; il ortalamaları / pompa listesi kaynağına bağlı.
- Groq / haber analizi hata verirse kural tabanlı sinyale düşülür.

## Veri kaynağı

Akaryakıt: Aytemiz resmi fiyat sayfaları. Makro: TCMB kurları. Haber: RSS / kaynak modülü. Analiz: Groq (yapılandırıldığında).

## Lisans ve katkı

Depo özel kullanım içindir; katkı süreci issue / PR ile ilerler.
