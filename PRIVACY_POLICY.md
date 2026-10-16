# Yakıt Radar — Gizlilik Politikası

**Son güncelleme:** 16 Ekim 2026

## English summary

Yakıt Radar is a fuel-price companion app. We do not collect names, phone numbers, or payment data. The app stores preferences locally, reads public fuel prices from our backend, and may register an anonymous installation ID plus Expo push token when you enable notifications. Coarse location is used only on your device to suggest a province; coordinates are not sent to our servers. Google AdMob may process advertising IDs for in-app ads, subject to your consent choices where required (including Google UMP in the EEA/UK). Contact us at ets123main@gmail.com for access or deletion requests.

---

Yakıt Radar (“uygulama”, “biz”), akaryakıt pompa fiyatlarını takip etmenize yardımcı olan bir mobil uygulamadır. Bu metin, uygulamayı kullandığınızda hangi verilerin işlendiğini, nerede saklandığını ve haklarınızı açıklar.

Hesap oluşturmanız gerekmez; ad, soyad, telefon numarası, e-posta adresi veya ödeme bilgisi **toplamayız ve talep etmeyiz**.

## 1. Veri sorumlusu ve iletişim

Veri sorumlusu: Yakıt Radar (paket adı: `com.pompametre.app`).

Gizlilik talepleri, sorular ve silme istekleri için: **[ets123main@gmail.com](mailto:ets123main@gmail.com)**

## 2. İşlenen veri kategorileri

### 2.1 Cihazda saklanan veriler (AsyncStorage)

Aşağıdaki bilgiler yalnızca cihazınızda saklanır; sunucuya gönderilmez:

- **İl ve karşılaştırma listesi:** Takip ettiğiniz iller, ana (hero) il seçimi.
- **Yakıt türü tercihi:** Benzin, motorin, LPG seçimleri.
- **Bildirim ayarları:** Şehir uyarıları, günlük uyarılar, haftalık özet, sessiz saatler (22:00–08:00, İstanbul saati) açık/kapalı.
- **Özel fiyat alarmları:** Şehir, yakıt, eşik ve koşul tanımlarınız.
- **Araç profili ve gider geçmişi:** Tüketim hesabı için girdiğiniz değerler.
- **Yakıt verisi önbelleği:** Son başarılı fiyat sorgusunun yerel kopyası (çevrimdışı kullanım).
- **Kurulum kimliği (installation ID):** Uygulama ilk kez ihtiyaç duyduğunda cihazda rastgele üretilen, `@pompametre/installation-id` anahtarıyla saklanan teknik kimlik. Bu kimlik, bildirim sunucusu kaydıyla eşleştirme için kullanılır.

Konumla il seçtiğinizde yalnızca **il adı** ve “konumdan seçildi” bilgisi yerel olarak saklanır; GPS koordinatları kalıcı olarak kaydedilmez.

### 2.2 Yaklaşık konum (ACCESS_COARSE_LOCATION)

İzin verdiğinizde uygulama, bulunduğunuz ili tahmin etmek için **yalnızca ön planda** yaklaşık konum kullanır (`expo-location`, düşük doğruluk). Koordinatlar **sunucuya gönderilmez**; cihazda ters coğrafi kodlama veya il merkezlerine göre en yakın il hesabı yapılır ve sonuç olarak yalnızca il adı uygulama içinde kullanılır. Arka plan konumu veya hassas (fine) konum izni istenmez.

### 2.3 Sunucuya giden veriler (Supabase)

Uygulama, yapılandırılmış bir Supabase projesine bağlanır:

| Veri | Amaç | Kimlik |
|------|------|--------|
| **Genel fiyat verileri** (`fiyatlar`, `gecmis`, `market_signals` okuma) | Güncel ve geçmiş pompa fiyatları, piyasa sinyali özetleri | Anonim okuma; kişisel profil yok |
| **Push kaydı** (`register_push_token` RPC) | Bildirim gönderimi ve tercihlerinize uygun filtreleme | `installation_id`, `expo_push_token`, platform (`ios`/`android`), uygulama sürümü, bildirim tercihleri (`city_alerts`, `daily_alerts`, `weekly_summary`, `quiet_hours`), takip edilen iller ve yakıt türleri listeleri, `last_seen_at` / `updated_at` |

Bildirim izni vermediğinizde veya token alınamadığında push kaydı sunucuya gönderilmez.

Test bildirimi veya fiyat yenileme isteği gibi işlemlerde yalnızca gerekli teknik alanlar (ör. `installation_id`) edge işlevine iletilebilir; bu çağrılar bildirim veya veri güncelleme amacıyla sınırlıdır.

### 2.4 Reklam tanımlayıcısı ve AdMob

Uygulama gelir modelinde **Google AdMob** (Google Mobile Ads SDK) kullanır:

- **Reklam tanımlayıcısı:** Android’de Reklam Kimliği (GAID) ve ilgili sinyaller Google tarafından reklam sunumu, ölçüm ve dolandırıcılık önleme amacıyla işlenebilir.
- **Tam ekran (interstitial) reklamlar:** Belirli sekme geçişleri sonrasında gösterilebilir; uygulama açılışında anında reklam gösterilmez.
- **Geliştirme derlemeleri:** Yalnızca Google’ın resmi test reklam birimleri kullanılır.
- **Onay (EEA / Birleşik Krallık):** Bu bölgelerde geçerli olduğunda Google **Kullanıcı Mesajlaşma Platformu (UMP)** ile reklam rızası toplanır. **Rıza olmadan reklam başlatılmaz ve reklam yüklenmez.** Kişiselleştirilmiş reklam profili oluşturma seçiminiz, reklam isteklerinde kişiselleştirilmiş / kişiselleştirilmemiş tercih olarak uygulanır.
- **Reklam kapalı senaryolar:** Birim kimliği yapılandırılmamışsa veya rıza verilmemişse reklam SDK’sı devre dışı kalır.

Google reklam işleme hakkında: [Google Gizlilik Politikası](https://policies.google.com/privacy).

## 3. Üçüncü taraf hizmetler

| Hizmet | Rol |
|--------|-----|
| **Supabase** | Fiyat verisi ve push token kayıtları için barındırılan veritabanı ve edge işlevleri |
| **Google AdMob** | Uygulama içi reklamlar |
| **Expo Push / FCM / APNs** | Bildirim iletimi (Expo push tokeni üzerinden) |

Bu sağlayıcılar kendi gizlilik politikalarına tabidir. Verilerinizi satmayız veya kiralamayız.

## 4. Android izinleri

| İzin | Neden |
|------|--------|
| **POST_NOTIFICATIONS** | Fiyat uyarıları ve özet bildirimleri (isteğe bağlı) |
| **ACCESS_COARSE_LOCATION** | Yalnızca cihazda il tahmini; koordinat sunucuya gitmez |
| **INTERNET** | Fiyat verisi ve bildirim kaydı |

## 5. Saklama süresi

- **Cihaz verileri:** Uygulamayı silene veya uygulama verilerini temizleyene kadar cihazınızda kalır.
- **Push kayıtları:** Bildirim tercihleriniz değiştikçe güncellenir; `last_seen_at` son kullanımı gösterir. Sunucu tarafında belirli bir otomatik silme süresi tanımlı değilse kayıtlar, bildirimleri kapattığınızda veya silme talebinde işleme alınana kadar tutulabilir.
- **Fiyat tabloları:** Kamuya açık pompa fiyatları; kişisel veri içermez.

## 6. Güvenlik

Sunucu ile uygulama arasındaki iletişim TLS ile şifrelenir. Push token tablosuna doğrudan istemci erişimi kısıtlıdır; kayıt yalnızca `register_push_token` RPC üzerinden yapılır.

## 7. Çocuklar

Uygulama 13 yaş altına yönelik değildir ve bilerek çocuklardan kişisel veri toplamayız.

## 8. Haklarınız

Bulunduğunuz ülkeye göre erişim, düzeltme, silme, işlemeyi kısıtlama ve itiraz haklarınız olabilir. Push ve kurulum kimliği kaydınızın silinmesini **ets123main@gmail.com** adresine yazarak talep edebilirsiniz; mümkün olduğunda makul sürede yanıt verilir.

Bildirimleri cihaz ayarlarından kapatabilir; uygulama içi bildirim anahtarlarını kapattığınızda sunucu kaydı güncellenir (`enabled` ve ilgili bayraklar).

## 9. Politika değişiklikleri

Bu sayfa güncellendiğinde “son güncelleme” tarihi değiştirilir. Önemli değişiklikler uygulama veya mağaza açıklaması üzerinden duyurulabilir.

## 10. Uygulama içi politika bağlantısı

Gizlilik politikasının web sürümü, yapılandırıldığında Bildirimler ekranından açılır (`EXPO_PUBLIC_PRIVACY_POLICY_URL`). Yayın URL’si GitHub Pages veya eşdeğer bir statik hosting üzerinde olabilir.
