# Play Store Yayın Kontrol Listesi

Bu belge, Yakıt Radar'ı Google Play'e çıkarmak için operatörün yapacağı adımları sırayla listeler. Repo tarafı hazır; aşağıdaki maddelerin çoğu **Play Console / Expo / AdMob / Google Cloud** panel işlemidir.

**Mevcut durum (14 Kasım 2026):**

- ✅ Sürüm `1.0.17`, paket `com.pompametre.app`, `versionCode` 13.
- ✅ Üretim fiyat hattı stabil: 12 Kasım 22:18'den beri planlı koşular yeşil.
- ✅ `production` profili AAB üretiyor (`eas.json`), `autoIncrement` açık.
- ✅ Gizlilik politikası, Data safety özeti ve statik sayfa hazır.
- ✅ APK ön kontrol aracı: `cd mobile && npm run release:preflight -- --production`.
- ⚠️ Mağaza görselleri, AdMob gerçek kimlikleri, Play Console formları ve gizlilik URL'si operatör adımı.

---

## 1. Ön koşullar

- [ ] Google Play Developer hesabı (tek seferlik **25 USD**).
- [ ] Kimlik doğrulama tamamlandı (kişisel hesap: kimlik; kurumsal: D-U-N-S).
- [ ] **Yeni kişisel hesaplar için test şartı:** production'a geçmeden önce kapalı testte **en az 12 test kullanıcısı, 14 gün kesintisiz**. Kural değişebilir; Play Console → Testing → Closed testing ekranındaki güncel metni esas alın.
- [ ] Ödeme profili ve vergi bilgileri (ücretli uygulama değilse de Play Console ister).
- [ ] `ets123main@gmail.com` destek adresi olarak doğrulandı.

---

## 2. Expo / EAS ortam değişkenleri

Expo dashboard → Project → **Environment variables**. `preview` ve `production` ortamlarına aynı anahtarları ekleyin:

| Değişken | preview | production | Not |
|----------|---------|------------|-----|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Proje kök adresi (`/rest/v1` eklenmez) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | Herkese açık anon anahtar |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | ✅ | ✅ | Play listesinde zorunlu |
| `ADMOB_ANDROID_APP_ID` | opsiyonel | ✅ zorunlu | Eksikse production build durur |
| `ADMOB_IOS_APP_ID` | opsiyonel | ✅ zorunlu | iOS yayını olmasa da build kontrolü ister |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID` | opsiyonel | önerilir | Yoksa reklamlar kapalı |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS` | opsiyonel | önerilir | iOS için |

Doğrulama:

```bash
cd mobile
npm run release:preflight -- --production
```

> EAS ortam değişkenleri yerelde görünmez; bu komut yalnızca kabuk ortamını kontrol eder. EAS dashboard'daki değerleri ayrıca doğrulayın.

---

## 3. AdMob kurulumu

- [ ] AdMob hesabı → **Uygulama ekle** → Android, `com.pompametre.app`.
- [ ] Android uygulama kimliği (`ca-app-pub-…~…`) → `ADMOB_ANDROID_APP_ID`.
- [ ] iOS uygulama kimliği → `ADMOB_IOS_APP_ID` (build zorunluluğu).
- [ ] Interstitial reklam birimi → `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID`.
- [ ] **UMP / GDPR mesajı** AdMob → Privacy & messaging → GDPR'de yapılandırıldı.
- [ ] `app-ads.txt` (opsiyonel ama önerilir): geliştirici web sitenizde yayınlayın; AdMob doğrulaması için.
- [ ] Test reklamlarıyla akış doğrulandı; production'da test birimi kullanılmıyor.

> Preview APK'da Google'ın örnek AdMob kimlikleri kullanılır; reklam geliri beklenmez. Gerçek gelir için production AAB gerekir.

---

## 4. Firebase / Google Cloud API anahtarı

- [ ] `google-services.json` içindeki API anahtarını Google Cloud Console'da **Android uygulama kısıtı** ile sınırla: paket `com.pompametre.app` + **EAS production imza SHA-1**.
- [ ] Gerekli API'ler yalnızca Firebase Cloud Messaging / Installations ile sınırlı.
- [ ] Geçmiş commit'lerde anahtar görünüyorsa **rotate** et ve eskiyi devre dışı bırak.
- [ ] Anahtar değeri repoya veya PR'a yazılmaz.

---

## 5. Gizlilik politikası URL'si

- [ ] GitHub → **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main`, klasör: `/docs`.
- [ ] Yayın URL'si açılıyor: `https://ekremtezcansaridag.github.io/YakitRadar/`.
- [ ] Aynı URL `EXPO_PUBLIC_PRIVACY_POLICY_URL` olarak EAS production ortamına eklendi.
- [ ] Play Console → Store listing → Privacy policy alanına girildi.
- [ ] Uygulama içi **Bildirimler → Gizlilik Politikası** satırı bu URL'yi açıyor.

Alternatif: herhangi bir statik hosting URL'si kullanılabilir; `docs/index.html` içeriğiyle aynı olmalı.

---

## 6. Mağaza görselleri ve metinleri

| Öğe | Gereksinim | Durum |
|-----|------------|-------|
| Uygulama ikonu | 512×512 PNG, 32-bit | ⚠️ `mobile/assets/icon.png`'den üretilecek |
| Öne çıkan grafik | 1024×500 PNG/JPG | ⚠️ Eksik |
| Telefon ekran görüntüsü | 2–8 adet, min 320 px | ⚠️ Eksik (`docs/screenshots/`) |
| 7" tablet ekran görüntüsü | Opsiyonel, önerilir | ⚠️ Eksik |
| 10" tablet ekran görüntüsü | Opsiyonel, önerilir | ⚠️ Eksik |
| Uygulama adı | ≤ 30 karakter | `Yakıt Radar` |
| Kısa açıklama | ≤ 80 karakter | Taslak aşağıda |
| Tam açıklama | ≤ 4000 karakter | Taslak aşağıda |
| Kategori | — | **Auto & Vehicles** (veya Tools) |
| İletişim e-postası | — | `ets123main@gmail.com` |

**Kısa açıklama taslağı (79 karakter):**
> 81 ilde benzin, motorin ve LPG fiyatları; geçmiş trend ve fiyat alarmları.

**Tam açıklama taslağı:**
> Yakıt Radar, Türkiye'deki 81 il için benzin, motorin ve LPG pompa fiyatlarını tek ekranda gösterir.
>
> • İl bazlı güncel fiyatlar ve 81 il ortalaması
> • 7 / 30 / 90 günlük fiyat trendleri
> • Haber ve piyasa verilerine dayalı beklenen değişim sinyali
> • Kişisel fiyat alarmları ve bildirimler
> • Araç yakıt tüketimi ve gider takibi
> • Çevrimdışı kullanım için son fiyat önbelleği
>
> Fiyatlar bilgilendirme amaçlıdır; resmi fiyat değildir. Güncel ve kesin fiyat için istasyonu teyit edin.

---

## 7. Play Console — App content formları

| Form | Cevap / not |
|------|-------------|
| **Privacy policy** | `docs/index.html` URL'si |
| **Ads** | Evet, uygulama reklam içeriyor (AdMob) |
| **App access** | Tüm işlevler erişilebilir; giriş gerekmez |
| **Content rating** | IARC anketi; şiddet/cinsellik/kumar yok, kullanıcı etkileşimi yok |
| **Target audience** | 13+ (çocuklara yönelik değil) |
| **News app** | Hayır (haber içeriği gösterilmiyor; yalnızca piyasa sinyali özeti) |
| **Data safety** | `docs/data-safety.md` tablosu birebir doldurulur |
| **Government app** | Hayır |
| **Financial features** | Hayır |
| **Health** | Hayır |

**Data safety özeti:**

- Device or other IDs: toplanıyor, bizim backend'imizde; push için.
- App activity (bildirim tercihleri): toplanıyor.
- Approximate location: **cihazda işleniyor**, sunucuya gönderilmiyor.
- Advertising ID: toplanıyor, Google ile paylaşılıyor (reklam).
- Veriler TLS ile şifreli; silme talebi e-posta ile.

> Konum için "toplanıyor / paylaşılmıyor / uygulama işlevi" seçin. Geocoder cihaz üzerinde çalıştığı için üçüncü taraf paylaşımı olarak işaretlenmez.

---

## 8. Build ve yükleme

1. **Sürüm/versionCode kontrolü:**
   - `appVersionSource: remote` olduğu için `versionCode` EAS tarafından yönetilir.
   - İlk production build'de EAS sürüm isterse: `npx eas-cli build:version:set -p android`.
   - Play Console'da daha önce yüklenmiş bir `versionCode` varsa ondan büyük olmalı.
2. **AAB üret:**
   ```bash
   cd mobile
   npx eas-cli build --profile production --platform android
   ```
   veya GitHub → Actions → **EAS Android Preview APK** yerine yerel/EAS production build.
3. **Play Console → Testing → Internal testing → Create new release** → AAB'yi yükle.
4. **Play App Signing** kaydını tamamla (EAS keystore upload key olur).
5. Internal test kullanıcılarını ekle, APK yerine **Play üzerinden** kur ve doğrula.
6. Kapalı test (12 tester / 14 gün) → production erişimi → **staged rollout** (%10 → %50 → %100).

**Opsiyonel otomasyon:** `eas submit` için Google Play service account JSON oluşturup `eas.json` → `submit.production.android.serviceAccountKeyPath` ile bağlayın. JSON anahtarı **repoya eklenmez**; EAS secret olarak tutulur.

---

## 9. Yayın öncesi son kontrol

- [ ] `npm run release:preflight -- --production` → 0 hata.
- [ ] `cd backend && pytest -q` → tüm testler yeşil.
- [ ] `cd mobile && npm run test:fuel-data-freshness && npm run test:privacy-links && npm run test:notification-permission-prompt` → yeşil.
- [ ] Play'den kurulan sürümde: fiyatlar geliyor, bayat veri banner'ı doğru, **ilk açılışta bildirim gerekçe ekranı bir kez çıkıyor** (kabul → sistem izni, "Şimdi değil" → tekrar sormuyor), reklamlar UMP sonrası yükleniyor.
- [ ] Gizlilik URL'si ve Data safety formu uygulama davranışıyla tutarlı.
- [ ] `docs/SPRINT_PLAN.md` Sprint 5 PR'ı merge edildi.

---

## 10. Yayın sonrası izleme

- Play Console → **Android vitals**: crash rate, ANR, startup süresi.
- **Reviews**: fiyat doğruluğu ve reklam şikâyetleri.
- Actions → **Günlük Fiyat Güncelleme**: planlı koşular yeşil mi?
- `Fiyat güncelleme sağlık uyarısı` issue'su açık mı?
- Veri kaynağı değişirse `fiyatlar.guncelleme` ve mobil bayat veri banner'ı.
- Gizlilik/Data safety beyanı değişirse Play Console formunu güncelle.

---

## 11. Hukuki / mağaza riski notu

- Fiyat kaynağı bir dağıtıcının kamuya açık sayfalarıdır; kullanım şartları ticari yeniden kullanımı kısıtlayabilir. Uygulama içi feragat ve kaynak notu mevcut (`FuelPriceLegalNote`, Hakkında).
- Orta vadede EPDK / resmi açık veri kaynağına geçiş planlanmalı (`PLAY_STORE_HAZIRLIK.md` → EPDK bölümü).
- Mağaza incelemesinde "resmi fiyat değildir" feragatının görünür olduğundan emin olun.
