# Güvenlik Politikası

## Desteklenen sürümler

| Sürüm | Destek |
|-------|--------|
| `1.0.x` (mobil) | ✅ Aktif |
| `1.0.17` ve sonrası | ✅ Güvenlik düzeltmeleri alır |
| `1.0.16` ve öncesi | ❌ Desteklenmiyor |
| Backend (`main`) | ✅ Sürekli güncel |

## Güvenlik açığı bildirimi

- **E-posta:** [ets123main@gmail.com](mailto:ets123main@gmail.com) — konu başlığı: `[SECURITY] Yakıt Radar`
- Lütfen açığı **herkese açık issue olarak açmayın**; önce e-posta ile bildirin.
- Yanıt süresi hedefi: 72 saat içinde ilk geri dönüş, 7 gün içinde değerlendirme.
- Bildirimde bulunurken: etkilenen sürüm, yeniden üretme adımları ve mümkünse ekran görüntüsü/log ekleyin.
- Anahtar veya token sızıntısı şüphesinde ilgili anahtarı hemen rotate edin (bkz. [`docs/OPERATIONS.md`](docs/OPERATIONS.md#7-secretlar-ve-rotasyon)).

## APK doğrulama

Yakıt Radar APK'ları **EAS Build** ile üretilir ve `preview` profili `internal` dağıtım için imzalanır.

| Kontrol | Beklenen |
|---------|----------|
| Paket adı | `com.pompametre.app` |
| Sürüm | `app.json` / `package.json` ile aynı (ör. `1.0.17`) |
| Kaynak | GitHub Actions → **EAS Android Preview APK** çalışması ve EAS build sayfası |
| İmza | EAS preview keystore (Play App Signing değil) |
| SHA-256 | EAS artifact ile karşılaştırılabilir |

Windows'ta hash:

```powershell
Get-FileHash .\yakit-radar.apk -Algorithm SHA256
```

Android SDK varsa imza sahibi:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat" verify --print-certs .\yakit-radar.apk
```

## Antivirüs yanlış pozitifleri (`APK:CloudRep[Susp]`)

Sideload edilen (Play Store dışından kurulan) APK'larda Avast/AVG şu uyarıyı gösterebilir:

```
APK:CloudRep [Susp]
```

Bu bir **virüs imzası değildir**. "Cloud reputation suspicious" yani **bulut itibarı düşük** demektir. Avast'ın kendi açıklamasına göre dosya çok yenidir ve yalnızca birkaç kişi tarafından görülmüştür.

Yakıt Radar'da bu uyarıyı tetikleyebilecek tipik nedenler:

- APK Play Store dışından kuruluyor (internal/EAS dağıtımı).
- İmza sertifikası yeni ve az bilinen bir EAS keystore.
- APK yeni üretildi; indirme sayısı düşük.
- Google Mobile Ads (AdMob) SDK ve reklam kimliği izni.
- Bildirim ve yaklaşık konum izinleri.
- React Native / Hermes bytecode yapısı.

### Ne yapmalı?

1. APK'nın yukarıdaki **APK doğrulama** kontrollerinden geçtiğini doğrula.
2. VirusTotal'e yükle: birkaç motor "suspicious/reputation" diyebilir; **gerçek trojan/spyware imzası** çıkmamalı.
3. Kişisel test cihazında Avast'ta **"İzin ver / Yoksay"** seçeneğini kullan. Antivirüsü tamamen kapatmak yerine bu istisnayı tercih et.
4. Yayın için **Play Store internal testing** kullan: Play App Signing + artan kurulum sayısı ile itibar uyarısı kaybolur. Avast, Play Store'dan yayınlanan uygulamalarda bu mesajın kullanıcıya görünmediğini belirtiyor.
5. Uyarı devam ederse Avast'a yanlış pozitif bildir:
   - Avast: <https://www.avast.com/false-positive-file-form.php>
   - AVG: <https://www.avg.com/false-positive-file-form>
   - Formda APK'yı, paket adını (`com.pompametre.app`) ve build kaynağını (GitHub Actions / EAS) belirt.

> **Not:** APK'yı üçüncü taraf "APK indirme" sitelerinden değil, yalnızca kendi EAS build sayfanızdan indirin. Kaynağı bilinmeyen APK'da aynı uyarı gerçek bir risk taşıyabilir.

## Secret politikası

- Supabase service role, Groq, Expo ve GitHub token'ları repoya **yazılmaz**.
- Yalnızca değişken **adları** dokümante edilir (`.env.example`, README).
- `EXPO_PUBLIC_*` değişkenleri istemciye gömülür; yalnızca herkese açık anahtarlar (Supabase anon) kullanılır.
