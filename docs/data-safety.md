# Google Play — Data safety özeti

Bu dosya Play Console **Data safety** formunu doldurmak için hazırlanmıştır. Değerler, `main` dalındaki mobil uygulama ve backend davranışına dayanır.

## Toplanan / paylaşılan veri türleri

| Veri türü (Play) | Toplanıyor | Paylaşılıyor | Amaç | Zorunlu | Şifreli aktarım | Silme |
|------------------|------------|--------------|------|---------|-----------------|-------|
| **Device or other IDs** — Kurulum kimliği (`installation_id`, uygulama içi üretim) | Evet | Hayır (yalnızca bizim backend) | Bildirim kaydı, cihaz eşleştirme | Hayır (bildirim açıkken) | Evet (TLS) | E-posta ile talep |
| **Device or other IDs** — Expo push token | Evet | Evet (Expo / FCM / APNs iletimi) | Push bildirimleri | Hayır | Evet | Bildirim kapatma + e-posta talebi |
| **App activity** — Bildirim tercihleri (iller, yakıt türleri, uyarı bayrakları, sessiz saat) | Evet | Hayır | Bildirim hedefleme | Hayır | Evet | Ayarları kapatma / e-posta |
| **Advertising ID** (GAID) | Evet (AdMob SDK) | Evet (Google) | Reklam sunumu, ölçüm | Hayır | Evet (Google) | Google / cihaz reklam ayarları + UMP tercihleri |
| **Approximate location** | Evet (cihazda) | **Hayır** | İl seçimi (yalnızca yerel işleme) | Hayır | N/A (sunucuya gitmez) | Uygulama verisini silme |
| **App info** — Platform, uygulama sürümü | Evet | Hayır | Push kaydı bakımı | Hayır | Evet | E-posta talebi |

**Toplanmayan:** Ad, e-posta, telefon, finansal bilgi, hassas konum (fine), sağlık, kişiler listesi.

## AD_ID bildirimi

- Uygulama **Google Mobile Ads SDK** kullanır → Play’de **Advertising ID** toplandığını beyan edin.
- Reklam kişiselleştirmesi: EEA/UK’de **UMP** onayı ve kullanıcı seçimi; onay yoksa reklam istenmez (uygulama sürümüne bağlı entegrasyon).
- `AndroidManifest` içinde AD_ID izni SDK tarafından yönetilir; mağaza formunda “reklam veya pazarlama” amaçlarını işaretleyin.

## Üçüncü taraf paylaşımı

| Alıcı | Veri | Amaç |
|--------|------|------|
| Google (AdMob) | Reklam kimliği, reklam etkileşim sinyalleri | Reklam |
| Expo / Google FCM / Apple APNs | Push token, bildirim içeriği | Bildirim iletimi |
| Supabase (barındırma) | Push kaydı, anonim fiyat okumaları | Altyapı |

## İzinler (Play “App permissions” / açıklama metni)

| İzin | Kullanıcıya açıklama |
|------|----------------------|
| **POST_NOTIFICATIONS** | Seçtiğiniz şehir ve yakıt türleri için fiyat uyarıları ve haftalık özet göndermek için kullanılır. İsteğe bağlıdır. |
| **ACCESS_COARSE_LOCATION** | Yalnızca cihazınızda bulunduğunuz ili tahmin etmek için kullanılır; koordinatlar sunucuya gönderilmez. İsteğe bağlıdır. |

## Veri güvenliği

- Kullanıcı verileri sunucuya giderken **TLS** kullanılır.
- Push token tablosu: istemci doğrudan okuyamaz; RPC ile yazılır.

## Silme ve kullanıcı kontrolleri

- Bildirim anahtarlarını kapatma → sunucu kaydı güncellenir.
- Tam silme: **ets123main@gmail.com** (kurulum kimliği / push token silme talebi).
- Yerel veriler: Android uygulama bilgilerinden depolamayı temizleme veya uygulamayı kaldırma.

## Politika URL’si

Mağaza listesinde gösterilecek gizlilik politikası: GitHub Pages `docs/index.html` (etkinleştirildiğinde) veya `EXPO_PUBLIC_PRIVACY_POLICY_URL` ile yapılandırılan URL.
