# Reklam ortam değişkenleri (EAS)

Gerçek kimlikler repoda tutulmaz; EAS Secrets veya build profili ortamında tanımlanır.

## Native uygulama kimlikleri (build zamanı)

| Değişken | Açıklama |
|---|---|
| `ADMOB_ANDROID_APP_ID` | AdMob Android uygulama kimliği (`app.config.js` → `react-native-google-mobile-ads` eklentisi) |
| `ADMOB_IOS_APP_ID` | AdMob iOS uygulama kimliği |

Production (`EAS_BUILD_PROFILE=production`) build’lerinde her iki değişken zorunludur; eksikse build durur. Preview ve yerel geliştirmede eksikse native çöküşü önlemek için Google’ın herkese açık örnek app ID’leri yedek olarak kullanılır (gerçek reklam birimi kimliği yoksa reklam yine kapalıdır).

## Interstitial birim kimlikleri (çalışma zamanı)

| Değişken | Açıklama |
|---|---|
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID` | Android tam ekran reklam birimi |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS` | iOS tam ekran reklam birimi |

Üretim derlemesinde platforma uygun birim kimliği yoksa reklam tamamen kapalıdır. Geliştirme (`__DEV__`) modunda yalnızca SDK test birimi kullanılır; üretimde test birimi kullanılmaz.

## Onay (UMP)

Ek secret gerekmez; `react-native-google-mobile-ads` `AdsConsent` akışı cihazda çalışır. AdMob konsolunda GDPR/UMP mesajlarının yapılandırıldığından emin olun.
