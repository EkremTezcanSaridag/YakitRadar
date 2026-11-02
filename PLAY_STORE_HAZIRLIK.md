# Play Store hazırlık planı

Bu belge mağaza gönderimi öncesi kontrol listesi ve ilk adımları özetler. Ödeme, mağaza gönderimi ve canlı veritabanı dağıtımı bu aşamada yapılmaz.

## (a) Veri kaynağı ve yasal risk

### Mevcut durum

- Backend, akaryakıt fiyatlarını bir dağıtıcı web sitesindeki kamuya açık fiyat tablolarından otomatik okur (`backend/fiyat_servisi.py`, sabit URL’ler).
- Site kullanım şartları metin/kopya ve ticari yeniden kullanımı kısıtlayabilir; otomatik çekim ve uygulamada gösterim hukuki inceleme gerektirir.

### Uygulama içi önlemler (bu PR)

- Fiyat ekranlarında kaynak notu ve “resmi değildir, tavsiye fiyattır” feragatı (`FuelPriceLegalNote`, `legalCopy.js`).
- **Hakkında** ekranında geniş feragat metni.
- Dağıtıcı logosu veya marka kimliği fiyat verisiyle ilişkilendirilmez; uygulama ikonları/markası bağımsızdır.

### Marka notu (kod taraması)

- **Aracım → yakıt fişi** istasyon listesinde “Aytemiz” adı kullanıcı fiş etiketi olarak geçer (`vehicleProfile.js` `fuelStations`); bu, fiyat kaynağını temsil etmez. Mağaza incelemesinde istasyon markalarının fiyat ekranlarında kullanılmadığını vurgulayın.
- Tema renklerinde `stationBrandAytemiz` yalnızca kullanıcı fişi rengi içindir.

### Orta vadeli: EPDK yan yana geçiş (kaynak sökmeden)

1. EPDK veya resmi açık veri seti için uygun API/CSV endpoint araştırması.
2. `fiyat_servisi.py` içinde ikinci okuyucu (adapter) + birleştirme/öncelik bayrağı (ör. `PRICE_SOURCE=epdk|legacy`).
3. Uygulamada kaynak satırını yapılandırılabilir metinle güncelleme.
4. Hukuki onay sonrası legacy kaynağı kapatma.

## (b) Gizlilik politikası ve Data safety

### Açık PR #34

- **Durum:** açık — gizlilik metni, Play Data safety özeti ve uygulama içi politika bağlantısı hedefleniyor.
- **Tamamlama:** #34 birleştirildikten sonra bu belgedeki Data safety maddeleri ile çapraz kontrol yapın.

### Kod taraması — toplanan / senkronlanan veriler

| Veri | Nerede | Sunucuya gider mi |
|------|--------|-------------------|
| `installation_id` (UUID, cihazda üretilir) | `notifications.js` → AsyncStorage | Evet, `register_push_token` RPC |
| Expo push token | `notifications.js` | Evet, aynı RPC |
| Bildirim tercihleri (şehir, yakıt, sessiz saat vb.) | AsyncStorage + RPC payload | Evet |
| `app_version`, `platform` | RPC payload | Evet |
| Favori iller, araç profili, alarmlar, UI tercihleri | AsyncStorage | Hayır (yalnızca cihaz) |
| Konum | İzin metni var; birincil şehir manuel/konum meta | Konum koordinatı sunucuya gönderilmez (kod incelemesi) |
| AdMob | UMP + SDK | Google politikasına tabi (GAID vb.) |

Play Console **Data safety** formunda en az: bildirim tokeni, kurulum/cihaz tanımlayıcısı, uygulama etkileşim tercihleri; reklam SDK ayrı beyan.

## (c) `mobile/google-services.json` ve API anahtarı

- Dosya yolu: `mobile/google-services.json` (Firebase / FCM yapılandırması).
- **Yapılacak (Google Cloud Console):** Android uygulama kısıtı — paket adı `com.pompametre.app` + **EAS production** imza SHA-1 parmak izi; ilgili API’lerde “Android apps” kısıtı.
- **Repo riski:** Geçmiş commit’lerde düz metin anahtar sızıntısı olabilir; anahtarı Console’dan **rotate** edip eski anahtarı devre dışı bırakın. Anahtar değerini repoda veya PR’larda asla paylaşmayın.
- CI/build: EAS secret veya build-time enjeksiyon tercih edilebilir (ayrı görev).

## (d) Uygulama içi feragat ve Hakkında

- **Hakkında** ekranı: sürüm, fiyat feragatı, genel feragat, gizlilik özeti (Bildirimler veya gizli sekme üzerinden erişim).
- Fiyat listesi ekranları: kısa kaynak + feragat bandı.

## (e) Teknik mağaza gereksinimleri

| Konu | Not |
|------|-----|
| **targetSdk** | Expo SDK 54 / `expo-build-properties` ile Play gereksinimine uygun sürüm doğrulanmalı (build log). |
| **İzinler** | `POST_NOTIFICATIONS`, `ACCESS_COARSE_LOCATION`; fine/background konum engelli (`app.json`). |
| **İmzalama** | EAS `production` profili, `versionCode` artışı her yayında. |
| **Sürüm** | `app.json` / `package.json` senkron. |

## İlk adımlar (öncelik sırası)

1. Bu PR’daki feragat + Hakkında ekranını QA ile doğrula.
2. PR #34’ü tamamla / birleştir; mağaza gizlilik URL’sini Play’e gir.
3. Google Cloud’da API anahtarı kısıtla + gerekirse rotate.
4. Data safety formunu kod tablosu ile doldur.
5. EAS production build + internal testing track.
6. EPDK veri kaynağı araştırmasını paralel başlat (legacy kaynak açık kalır).

## Geri alma

- Feragat bileşeni ve Hakkında ekranı bağımsız dosyalarda; geri almak için ilgili commit’ler revert edilebilir.
- Backend scraper’a dokunulmadı.
