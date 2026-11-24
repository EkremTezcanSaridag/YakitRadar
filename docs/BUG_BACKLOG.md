# Hata / İstek Günlüğü

**Amaç:** Test döneminde bulunan sorunları tek yerde tutmak. Kod değişikliği, liste
olgunlaştıktan sonra tek PR'da yapılacak. Yeni madde eklerken aynı başlık düzenini kullan.

**Durum:** 4 maddenin kodu `feat/1.0.19-expected-realized-and-ui-fixes` dalında uygulandı.
Sürüm bump / PR bekliyor; mevcut 1.0.18 test edilmeye devam ediyor.

| # | Başlık | Tür | Öncelik | Durum |
|---|--------|-----|---------|-------|
| 1 | Beklenen zam/indirim gerçekleşince bildirim yok | Eksik özellik | P1 | Kod tamam, test edildi |
| 2 | Açılışta otomatik yenileme algısı / "Yenile" bandı | UX + davranış | P1 | Kod tamam, test edildi |
| 3 | Alt bar aktif gösterge (mavi katman) butonu kaplamıyor | UI | P2 | Kod tamam, test edildi |
| 4 | İl arama listesi klavyenin altında kalıyor | UI / klavye | P1 | Kod tamam, cihaz testi bekliyor |

---

## 1. Beklenen zam/indirim gerçekleşince bildirim yok

**Belirti (kullanıcı):** Haber analizi "LPG'ye 5,20 TL zam bekleniyor" diyor, ertesi gün
gerçekten yansıyor; ama "5,20 TL LPG indirimi/zammı geldi" şeklinde bir bildirim gelmiyor.

**Mevcut durum (kod):**
- Beklenti bildirimi **var**: `backend/fiyat_servisi.py:625-641`
  (`type: "expected_change"`, başlık `"Beklenen LPG artış"`).
- Gerçekleşme bildirimi **yok**. Ayrıca `backend/notification_rules.py:261`
  (`select_price_changes_for_token`) `source == "expected_change"` satırlarını gerçek
  değişim hattından **dışlıyor**; yani beklenti ile gerçekleşme arasında bağ kurulmuyor.
- Gerçek değişim bildirimi il bazlı gidiyor: `"İstanbul · LPG zammı"`.
- Eşleştirme için gereken veri **zaten var**: `market_signals` tablosundaki
  `benzin_expected_amount_tl`, `motorin_expected_amount_tl`, `lpg_expected_amount_tl`
  (yazımı: `fiyat_servisi.py:902-904`).

**Öneri:**
1. Scrape sonrası gerçek değişim ile son 24-48 saatlik beklentiyi karşılaştır.
2. Yön aynı ve tutar tolerans içindeyse (örn. ±0,50 TL veya ±%25) tek seferlik
   "Beklenen zam gerçekleşti: LPG 5,20 TL" bildirimi gönder.
3. Aynı gün + aynı yakıt için dedupe (`expected_change_dedupe_key` benzeri bir anahtar).
4. Beklenti yoksa mevcut il bazlı mesaj aynen kalsın.
5. Bildirim `data` alanına `type: "expected_realized"` + `fuel` + tutar ekle; ileride
   tıklanınca ilgili ekrana gitmek için kullanılır.

**Dosyalar:** `backend/fiyat_servisi.py`, `backend/notification_rules.py`,
`mobile/src/services/notifications.js` (bildirim tipi eşlemesi), testler:
`backend/test_*notification*`.

**Uygulama notu (1.0.19 dalı):** `backend/expected_change_realized.py` saf eşleştirme
yapar (yakıt bazında medyan gerçek değişim, yön + `max(0.75 TL, %35)` toleransı,
en yeni sinyal, dedupe). `fiyat_servisi.py` son 3 günün `market_signals.signals`
kaydını okur, eşleşirse tek cihaza tek push'ta
`"Beklenen LPG indirimi gerçekleşti"` başlığını ve tutarı gönderir; aynı yakıt için
bekleyen "Beklenen …" bildirimi atlanır. `data.type = expected_change_realized`.

---

## 2. Açılışta otomatik yenileme algısı

**Belirti (kullanıcı):** Uygulama her açılışta kendisi yenilemiyor; "fiyatlar 6 saattir
güncel değil" deyip "Yenile" istiyor.

**Mevcut durum (kod):** Otomatik kontrol **zaten var**:
- `mobile/src/hooks/useFuelData.js:147` → `loadFuelData({ refresh: true, triggerBackend: true })`
- Backend kuyruğa alınırsa 45 sn sonra ikinci kontrol: `useFuelData.js:86-101`
- Ağ geri gelince tekrar deneme: `useFuelData.js:180-191`

**Kök neden (sunum):**
- Band, `savedAt` (son başarılı yazma) 6 saatten eskiyse gösteriliyor:
  `fuelDataCheckMeta.js:19`, metin `fuelDataViewState.js:35-39`.
- Açılışta önce cache basılıyor → eski `savedAt` ile band **anlık** görünüyor.
- Bootstrap sırasında `refreshing` **true yapılmıyor** (sadece kullanıcı yenilemesinde).
  Bu yüzden bandın butonu "Yenile" olarak aktif kalıyor: `FuelDataStatusBanner.js:16`.
- Ağ yavaş/çevrimdışıysa kontrol başarısız olur ve band kalıcılaşır.

**Karar (öneri):**
- Her açılışta arka planda otomatik kontrol **kalsın** (doğru davranış, egress açısından
  açılış başına ~20 KB).
- 60 saniyelik görünmez bir alt sınır koy (art arda açılışta aynı isteği atmasın).
- Band mantığı düzeltilsin:
  - Bootstrap'ta `refreshing: true` → buton "Yenileniyor" ve pasif.
  - Kontrol sürerken stale bandı yerine "Kontrol ediliyor…" göster.
  - Kontrol başarısızsa ayrı metin: "Bağlantı kurulamadı, son kayıtlı fiyatlar".
  - 6 saat metni "son kontrol"a değil, gerçek veri yaşına göre kalsın (24 saat eşiği zaten var).

**Dosyalar:** `mobile/src/hooks/useFuelData.js`,
`mobile/src/services/fuelDataViewState.js`, `mobile/src/components/FuelDataStatusBanner.js`,
`mobile/src/services/fuelDataCheckMeta.js`.

**Uygulama notu (1.0.19 dalı):** Bootstrap ve ön plana dönüşte `autoRefreshing: true`
işaretlenir; band "Fiyatlar kontrol ediliyor…" metnini gösterir ve butonu pasifleşir.
`shouldRunForegroundCheck` ile 60 sn alt sınır eklendi; çevrimdışı bandı ayrı metnini
koruyor.

---

## 3. Alt bar aktif gösterge butonu kaplamıyor (hizalama)

**Belirti (kullanıcı):** Alt barda "İller" sekmesindeki mavi katman butonu tam
kaplamıyor; hizalama sorunu var.

**Kök neden (kod):**
- Gösterge sabit genişlikte: `mobile/src/utils/tabPillLayout.js:1` → `PILL_WIDTH = 52`.
- Sekme genişliği 56 px'den büyükse her zaman 52 px kullanılıyor
  (`resolvePillWidth`, satır 6-16); 5 sekmede genişlik ~64 px olduğu için
  gösterge kutunun ~%81'ini kaplıyor.
- Gösterge yalnızca ikon merkezine hizalanıyor, ikon+etiket bloğunu kapsamıyor
  (`computeTabPillTop`, satır 29-36).
- Yatay konum `itemFrame.x + (width - pillWidth) / 2`; bar padding'i
  (`App.js` floating bar) ile birlikte kenar sekmelerde kayma görülebiliyor.

**Öneri:**
1. Genişliği sabit 52 yerine `min(itemWidth - 8, içerik genişliği)` olarak hesapla.
2. Ya yalnızca ikonu vurgula (mevcut tasarım) ya da ikon+etiket yüksekliğini kapsa;
   ikisi karışık olmasın.
3. Kenar sekmeler için `translateX` hesabına bar padding'ini ekle veya göstergenin
   `left` referansını sekme kapsayıcısına taşı.
4. `mobile/scripts/tabPillLayout.test.mjs` benzeri testlerde 5 sekme / dar ekran /
   tablet senaryolarını doğrula.

**Dosyalar:** `mobile/src/components/SakinSolmaTabBar.js`,
`mobile/src/utils/tabPillLayout.js`, ilgili testler.

**Uygulama notu (1.0.19 dalı):** `resolvePillWidth` sekme genişliğinden türetiliyor
(`itemWidth - 8`, 40–72 px arası). Yatay konum aynı inset kullanılarak sekme
merkezine hizalanıyor; 320/360/390/412 px ekran testleri eklendi.

---

## 4. İl arama listesi klavyenin altında kalıyor

**Belirti (kullanıcı):** İl seçerken arama yapılıyor; seçilecek il listenin altında
kalıyor, klavyenin altına düşüyor. Seçim menüsü klavyenin arkasında kalıyor.

**Etkilenen yerler:**
- `mobile/src/components/CityPickerModal.js` — "İl ara…" alt sayfası. Kullanım:
  `AnaSayfa.js:400` ve `AnaSayfa.js:407` (favori/şehir değiştirme),
  `LocationOnboarding.js:85` (ilk açılışta şehir seçimi).
- `mobile/src/screens/Iller.js:134` — İller ekranındaki arama kutusu (aynı ScrollView
  içinde liste).

**Kök neden (kod):**
- `CityPickerModal` bir `Modal` içinde `backdrop (flex: 1)` + alta yaslı `sheet`
  (`maxHeight: '72%'`) kullanıyor; **`KeyboardAvoidingView` yok**.
- Android'de `Modal` ayrı pencere açtığı için klavye açılınca yükseklik küçülmüyor;
  sayfa ekranın altına sabit kalıyor, klavye üstünü kapatıyor.
- Liste `ScrollView style` ile veriliyor, `contentContainerStyle` ile alt boşluk
  eklenmiyor → klavye yüksekliği kadar kaydırma payı yok.
- `Iller.js` ana ScrollView'da `keyboardShouldPersistTaps` yok → klavye açıkken ilk
  dokunuş sadece klavyeyi kapatıyor, satır seçilmiyor.

**Öneri:**
1. `CityPickerModal`'ı `KeyboardAvoidingView` ile sar:
   - iOS: `behavior="padding"`
   - Android: `behavior="height"` (veya `Keyboard` olaylarıyla ölçülen yükseklik kadar
     `marginBottom`)
2. `sheet` yüksekliğini `ekran − klavye` üzerinden hesapla; `maxHeight`'i sabit %72
   bırakma.
3. Listeye `contentContainerStyle={{ paddingBottom: klavyeYüksekliği + 24 }}` ekle.
4. `Iller.js`: `keyboardShouldPersistTaps="handled"` + `keyboardDismissMode="on-drag"`.
5. Test: Android'de 3 tuşlu/gesture navigasyon, küçük ekran ve tablet; ilk açılış
   (onboarding) senaryosu mutlaka denenmeli.

**Dosyalar:** `mobile/src/components/CityPickerModal.js`,
`mobile/src/screens/Iller.js`, `mobile/src/screens/LocationOnboarding.js`.

**Uygulama notu (1.0.19 dalı):** Modal `KeyboardAvoidingView` ile sarıldı (iOS
`padding`, Android `height`); sheet `%68` ile sınırlandı, liste klavye yüksekliği
kadar ek alt boşluk alıyor. `Iller.js` ScrollView `keyboardShouldPersistTaps="handled"`
ve `keyboardDismissMode="on-drag"` aldı. Android/iOS cihaz doğrulaması hâlâ gerekli.

---

## Sonra eklenecekler

- (yeni maddeler buraya)
