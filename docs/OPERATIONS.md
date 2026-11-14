# Operasyon Runbook'u

Bu belge, fiyat güncelleme hattında bir sorun çıktığında operatörün izleyeceği adımları özetler. Kod değişikliği gerektirmeyen acil müdahaleler ve doğrulama sorguları burada.

**İlgili belgeler:** [`docs/scheduled-price-refresh.md`](scheduled-price-refresh.md) (zamanlama), [`docs/edge-refresh.md`](edge-refresh.md) (mobil yenileme), [`docs/SPRINT_PLAN.md`](SPRINT_PLAN.md) (yapılan işler).

---

## 1. Hızlı sağlık kontrolü (2 dakika)

| Kontrol | Nerede | Beklenen |
|---------|--------|----------|
| Son koşu durumu | GitHub → Actions → **Günlük Fiyat Güncelleme** | Yeşil; son çalışma ≤ 1 saat |
| Veri tazeliği | Supabase SQL Editor | `select max(guncelleme) from public.fiyatlar;` son 1 saat içinde |
| Açık uyarı issue'su | GitHub → Issues | `Scheduled guncelle workflow failed` ve `Fiyat güncelleme sağlık uyarısı` kapalı |
| Geçmiş grafiği | Supabase | `select tarih, benzin_95, motorin, lpg from public.gecmis order by tarih desc limit 5;` — düz/tekrarlı satır yok |
| Kuyruk | Supabase | `select count(*) from public.pending_price_notifications where sent_at is null;` — sessiz saat dışında 0'a yakın |

Veri 24 saatten eskiyse mobil uygulama `Fiyatlar 24 saatten eski · Kaynak: …` banner'ını gösterir; bu bir arıza sinyalidir, normal durum değildir.

---

## 2. Manuel fiyat güncellemesi (acil)

1. GitHub → **Actions** → **Günlük Fiyat Güncelleme** → **Run workflow**.
2. Branch: `main`. `price_sanity_override` **kapalı** bırak.
3. Koşu biterken **Fiyatları güncelle** adımının özetini oku:
   - `scrape_ok=true`, `sanity_blocked=false` → normal.
   - `sanity_blocked=true` → 3. bölüme geç.

Alternatif: mobil uygulamadaki yenileme butonu `refresh-prices` Edge Function üzerinden aynı workflow'u tetikler ([`docs/edge-refresh.md`](edge-refresh.md)).

### Zamanlanmış koşu neden atlandı?

Workflow logunda şu satırları ara:

```
gate_event_name=schedule
gate_schedule=7,27,47 * * * *
Scraper atlandi; fiyatlar yeterince guncel.
```

- `gate_schedule=10 5 * * *` olan sabah koşusu **gate'sizdir**; her zaman tam koşar.
- Diğer koşularda veri 45 dakikadan tazeyse scraper atlanır (`SCHEDULE_FRESHNESS_MAX_AGE_MINUTES`). Bu normaldir.
- Tüm koşular atlanıyor ve veri yine de eskiyse Supabase saat dilimi / `guncelleme` formatını kontrol edin.

---

## 3. Guard alarmı triyajı

**Belirti:** Issue `Fiyat güncelleme sağlık uyarısı` açıldı veya run özetinde `sanity_blocked=true`.

1. Run özetindeki `::warning::` satırlarını oku: hangi yakıt, kaç il, ne kadar sapma?
   - Benzin / motorin: %10 sapma eşiği
   - LPG: %25 sapma eşiği
2. Kaynağı doğrula (Aytemiz sayfası veya scraper logundaki `http_status`, `match_count`):
   - **Gerçek değişim** (zam/indirim ilan edilmiş): 4. adıma geç.
   - **Kaynak hatası** (sayfa yapısı değişti, yarım veri, tek il): guard'ı zorlamayın; scraper düzeltmesi gerekir.
3. Kısmi blok normaldir: yalnızca anormal yakıt eski değerde kalır, diğer yakıtlar yazılır. Benzin/motorin akıyorsa panik yok.
4. Gerçek ve büyük değişimde tek seferlik override:
   - **Actions → Run workflow** → `price_sanity_override` = **true**.
   - Yalnızca elle tetiklemede geçerlidir; zamanlanmış koşuları etkilemez.
   - Override hem toplu sapma hem günlük `gecmis` değişim kontrolünü atlar.
5. Override sonrası doğrula:
   ```sql
   select il, benzin_95, motorin, lpg, guncelleme
   from public.fiyatlar
   order by guncelleme desc
   limit 5;
   ```
6. Uyarı issue'su bir sonraki başarılı koşuda otomatik kapanır. Kapanmazsa issue'ya run linkiyle not düşün.

> **Not:** Üç yakıt da aynı anda anormalse workflow bilinçli olarak düşer. Bu, gerçek bir olay veya ciddi kaynak hatası sinyalidir; körlemesine override etmeyin.

---

## 4. Scraper hatası

**Belirti:** Issue `Fiyat güncelleme sağlık uyarısı` içinde "Scraper başarısız oldu; fiyatlar ve geçmiş yazılmadı".

- Bu durumda `gecmis`'e **düz satır yazılmaz** (Sprint 2). Grafik bozulmaz.
- Logda `http_status` ve `match_count` değerlerine bakın:
  - `http_status=403/429` → kaynak engelliyor; istek sıklığını düşürün, birkaç saat bekleyin.
  - `http_status=200`, `match_count` düşük → sayfa yapısı değişmiş; `fiyat_servisi.py` parser'ı güncellenmeli.
- Kaynak düzelene kadar mobil taraf son kayıtlı fiyatları ve bayat veri banner'ını gösterir.
- Scraper düzeldiğinde manuel koşu ile doğrulayın; issue otomatik kapanır.

---

## 5. Bildirim kuyruğu (sessiz saat)

- Sessiz saat: **22:00–08:00** İstanbul. Bu aralıkta üretilen fiyat değişimleri `pending_price_notifications` tablosuna yazılır.
- 08:00 sonrası ilk uygun koşu (sabah `10 5 * * *` UTC) kuyruğu tek bildirimde birleştirir.
- Kuyruk gönderilmiyorsa:
  ```sql
  select id, dedupe_key, detected_at, sent_at
  from public.pending_price_notifications
  where sent_at is null
  order by detected_at;
  ```
- Manuel flush: **Actions → Günlük Fiyat Güncelleme → Run workflow** (gate dışı tam koşu) veya scraper atlanan koşuda otomatik çalışan `notification_pending_flush.py` adımı.
- Gönderim hatasında kayıt kuyrukta kalır; `sent_at` yalnızca başarılı gönderimde dolar.

---

## 6. Supabase SQL uygulama sırası

SQL dosyaları **otomatik çalışmaz**; Supabase SQL Editor'de sırayla uygulanır. Bağımlılık sırası:

| # | Dosya | Not |
|---|-------|-----|
| 1 | `backend/supabase_fiyatlar_gecmis.sql` | `fiyatlar` + `gecmis` temel tabloları ve RLS |
| 2 | `backend/supabase_market_signals.sql` | Piyasa sinyali tablosu |
| 3 | `backend/supabase_market_signals_expected_amounts.sql` | Opsiyonel; beklenen tutar kolonları |
| 4 | `backend/supabase_notifications.sql` | `push_tokens` + `register_push_token` RPC |
| 5 | `backend/supabase_push_token_hygiene.sql` | Opsiyonel; receipt/temizlik kolonları |
| 6 | `backend/supabase_pending_notifications.sql` | Sessiz saat kuyruğu |
| 7 | `backend/supabase_price_change_events.sql` | Opsiyonel; mobil şu an `gecmis` kullanıyor |
| 8 | `backend/supabase_gecmis_unique_tarih.sql` | **En son.** Önce `tarih` bazında mükerrer kayıtları temizleyin, yoksa unique index oluşmaz |

Doğrulama:

```sql
-- Mükerrer gün var mı? (unique index öncesi 0 olmalı)
select tarih, count(*) from public.gecmis group by tarih having count(*) > 1;

-- RLS açık mı?
select relname, relrowsecurity from pg_class where relname in ('fiyatlar','gecmis','push_tokens');
```

---

## 7. Secret'lar ve rotasyon

| Secret | Kullanım | Rotasyon |
|--------|----------|---------|
| `SUPABASE_URL` | Backend bağlantısı | Proje taşınmadıkça değişmez |
| `SUPABASE_KEY` | Anon okuma | Supabase panelinden yeni anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | Yazma + RPC | Sızıntı şüphesinde hemen rotate |
| `GROQ_API_KEY` | Piyasa analizi | Sağlayıcı panelinden |
| `EXPO_TOKEN` | EAS APK build | Expo → Access tokens |
| `GITHUB_ACTION_TOKEN` | Edge Function → workflow | Fine-grained, yalnızca Actions:write |

- Anahtarlar repoya **yazılmaz**; yalnızca isimleri dokümante edilir.
- `PRICE_SANITY_OVERRIDE` artık secret değil; `workflow_dispatch` girdisi olarak verilir.
- Sızıntı şüphesinde: anahtarı rotate et → eski anahtarı Supabase/Groq tarafında iptal et → son 24 saatlik workflow loglarında anahtar araması yap.

---

## 8. Geri alma (rollback)

1. Hatalı commit'i `main` üzerinden revert et:
   ```bash
   git revert <commit>
   git push origin main
   ```
2. Workflow değişikliği acilse: Actions → ilgili run → **Re-run jobs** yerine önceki yeşil commit'ten `workflow_dispatch` çalıştırın (workflow dosyası `main`'den okunur; bu yüzden revert gerekir).
3. Veri bozulduysa (yanlış fiyat yazıldı):
   - Etkilenen illeri ve tarihi belirleyin.
   - `fiyatlar` için önceki değerleri kaynaktan doğrulayıp manuel `update` yapın.
   - `gecmis` için yalnızca hatalı `tarih` satırını düzeltin; toplu `delete` yapmayın.
4. Geri alma sonrası manuel koşu + doğrulama sorguları (bölüm 1) çalıştırın.

---

## 9. Mobil sürüm notu

- Fiyat verisi 24 saatten eskiyse uygulama bayat veri banner'ı gösterir ve tasarruf tahminini gizler.
- Bu davranış bilinçlidir; veri hattı düzeldiğinde banner kendiliğinden kaybolur.
- APK/build sorunları için [`PLAY_STORE_HAZIRLIK.md`](../PLAY_STORE_HAZIRLIK.md) ve [`mobile/docs/ads-eas-env.md`](../mobile/docs/ads-eas-env.md).
