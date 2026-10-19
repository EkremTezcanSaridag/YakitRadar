# Zamanlanmış fiyat güncelleme

## Varsayılan: GitHub Actions (`guncelle.yml`)

- Zamanlama: `7,27,47 * * * *` (UTC) ve sabah `10 5 * * *` (TR sessiz saat kuyruğu).
- Zamanlanmış koşularda (`7,27,47 * * * *` UTC), checkout öncesi hafif adım: `fiyatlar.guncelleme` son kayıt **45 dakikadan** yeniyse scraper atlanır (`SCHEDULE_FRESHNESS_MAX_AGE_MINUTES`).
- Sabah koşusu `10 5 * * *` (sessiz saat kuyruğu + beklenen değişim) **freshness gate’e tabi değildir**; veri taze olsa bile her zaman tam koşu çalışır. Aksi halde önceki `:07` UTC koşusu veriyi tazeleyip `:10` koşusunu atlatır ve kuyruktaki bildirimler gitmez.
- `workflow_dispatch` ve `main` push tetiklemelerinde freshness atlanır; tam koşu çalışır.
- Concurrency grubu: `guncelle-price-update`.

### Actions dakika bütçesi (tahmin)

| Ortam | Not |
|--------|-----|
| **Public repo** | Actions dakikası ücretsiz (makul kullanım); bu cron sıklığında dakika bütçesi sorunu olmaz. |
| **Private repo** | Ayda ~2000 dakika ücretsiz. |

**Private repo notu:** `7,27,47 * * * *` ile günde **72** zamanlanmış koşu (sabah `10 5` ayrı). Her koşu gate dahil en az ~1 dakika faturalanırsa 72 × 30 ≈ **2160** dakika/ay, 2000 dakikalık ücretsiz kotayı aşar. Private’a geçilirse cron’u örneğin `7,37 * * * *` (günde 48 koşu) seviyesine indirmek gerekir; kullanımı Actions sayfasından doğrulayın.

Örnek (private, 3 zamanlanmış koşu/saat ≈ 72/gün):

- Erken çıkış (yalnızca gate): ~0,5–1 dk faturalanır.
- Tam koşu (checkout + pip + scraper): ~1,5–2 dk.

Aylık: 72 × 30 ≈ 2160 koşu. Hepsi erken çıkışsa ~1080–2160 dk; hepsi tam koşuysa ~3240–4320 dk. Gerçek kullanım genelde arada kalır; veri bayatsa tam koşu sıklaşır. Sıklığı artırmadan önce Actions kullanım sayfasından doğrulayın.

## Alternatif (canlıya uygulanmaz): Supabase `pg_cron`

Örnek yön: `pg_cron` + `net.http_post` ile mevcut `refresh-prices` Edge Function’ı tetiklemek. Bu, projede **yalnızca referans** olarak düşünülmeli; migration veya canlı SQL bu repoda uygulanmaz.

```sql
-- ÖRNEK — canlıda çalıştırmayın; operatör uyarlanır ve test eder.
-- select cron.schedule(
--   'hourly-refresh-prices',
--   '7,27,47 * * * *',
--   $$ select net.http_post(
--        url := '<edge-function-url>',
--        headers := jsonb_build_object('Authorization', 'Bearer <service-role-jwt>'),
--        body := '{}'::jsonb
--      ); $$
-- );
```

Edge URL ve anahtar değerleri repoda tutulmaz.
