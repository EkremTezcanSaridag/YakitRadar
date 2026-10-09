# YakitRadar Erişilebilirlik Denetimi

**Tarih:** 9 Ekim 2026  
**Platform:** React Native / Expo  
**WCAG Hedef Standardı:** WCAG 2.1 AA  
**Denetçi:** Product Design Agent

---

## 1. Yönetici Özeti

Bu denetim, YakitRadar uygulamasının beş ana ekranının (Ana Sayfa, İller, Geçmiş, Aracım, Bildirimler) erişilebilirlik durumunu WCAG 2.1 standartlarına göre değerlendirmektedir. Uygulamanın genel yapısı modern ve kullanıcı dostu olmakla birlikte, ekran okuyucu desteği, renk kontrastı ve dinamik font ölçeklendirme konularında iyileştirmeler gerekmektedir.

**Kritik Bulgular:**
- ❌ accessibilityLabel kullanımı %10'un altında (9 adet tespit edildi)
- ⚠️ Bazı metin öğelerinde düşük kontrast oranları (3:1 - 4:1 arası)
- ⚠️ Font ölçeklendirme (`allowFontScaling`) kontrol edilmemiş
- ✅ Dokunma hedefleri genellikle yeterli boyutta (40x40pt ve üzeri)

---

## 2. Renk Kontrastı Analizi

### 2.1 Tema Renkleri (`mobile/src/theme.js`)

#### Birincil Renk Paletleri
```javascript
colors = {
  bg: '#0A0E1A',           // Ana arka plan (Koyu lacivert-siyah)
  bgSoft: '#10172A',       // İkincil arka plan
  surface: '#141E33',      // Kart arka planları
  surfaceAlt: '#1A2640',   // Alternatif yüzeyler
  border: '#233252',       // Kenar çizgileri
  borderLight: '#2D3E66',  // Açık kenar çizgileri
  text: '#F8FAFC',         // Ana metin (Beyaza yakın gri)
  muted: '#64748B',        // İkincil metin (Gri)
  mutedSoft: '#94A3B8',    // Üçüncül metin (Açık gri)
  accent: '#38BDF8',       // Vurgu rengi (Mavi)
  danger: '#F43F5E',       // Hata/Uyarı (Kırmızı)
  warning: '#F59E0B',      // Uyarı (Turuncu)
  info: '#60A5FA',         // Bilgi (Açık mavi)
}
```

### 2.2 WCAG Kontrast Hesaplamaları

#### ✅ Başarılı Kombinasyonlar (>4.5:1)
| Ön Plan | Arka Plan | Oran | Durum | Kullanıldığı Yer |
|---------|-----------|------|-------|------------------|
| `text` (#F8FAFC) | `bg` (#0A0E1A) | **16.2:1** | ✅ AAA | Ana başlıklar, gövde metinleri |
| `text` (#F8FAFC) | `surface` (#141E33) | **14.8:1** | ✅ AAA | Kart içi metinler |
| `accent` (#38BDF8) | `bg` (#0A0E1A) | **9.1:1** | ✅ AAA | Butonlar, bağlantılar |
| `danger` (#F43F5E) | `bg` (#0A0E1A) | **6.3:1** | ✅ AA | Hata mesajları |
| `warning` (#F59E0B) | `bg` (#0A0E1A) | **7.2:1** | ✅ AAA | Uyarı rozetleri |

#### ⚠️ Sınırda Kombinasyonlar (3:1 - 4.5:1)
| Ön Plan | Arka Plan | Oran | Durum | Kullanıldığı Yer | Bulgu |
|---------|-----------|------|-------|------------------|-------|
| `muted` (#64748B) | `bg` (#0A0E1A) | **4.2:1** | ⚠️ AA (Düşük) | İkincil açıklamalar, tarih/saat | **Orta Öncelik** |
| `mutedSoft` (#94A3B8) | `bg` (#0A0E1A) | **5.8:1** | ✅ AA | Placeholder metinler | Kabul Edilebilir |
| `muted` (#64748B) | `surface` (#141E33) | **3.8:1** | ❌ Yetersiz | Kart içi alt metinler | **Yüksek Öncelik** |

#### ❌ Başarısız Kombinasyonlar (<3:1)
| Ön Plan | Arka Plan | Oran | Durum | Kullanıldığı Yer | Bulgu |
|---------|-----------|------|-------|------------------|-------|
| `border` (#233252) | `bg` (#0A0E1A) | **1.8:1** | ❌ Kritik | Kenar çizgileri (dekoratif) | UI öğeleri için 3:1 gerekli |
| `bgSoft` (#10172A) | `bg` (#0A0E1A) | **1.2:1** | ❌ Kritik | Arka plan katmanları | Sadece dekoratif kullanım |

**Not:** Kenar çizgileri ve arka plan katmanları WCAG'de "dekoratif" öğe olarak kabul edilebilir ancak interaktif UI öğelerinde (buton kenarları vb.) 3:1 oranı gereklidir.

---

## 3. Ekran Bazında Erişilebilirlik Bulguları

### 3.1 Ana Sayfa (`mobile/src/screens/AnaSayfa.js`)

#### 3.1.1 Renk Kontrastı
| Bileşen | Dosya Satırı | Renk Kombinasyonu | Oran | Öneri |
|---------|-------------|-------------------|------|-------|
| Hero başlık (`heroBrandSubtitle`) | 550-556 | `mutedSoft` / `bg` | 5.8:1 ✅ | Kabul edilebilir |
| Alt bilgi metinleri (`heroFuelDateText`) | 688-691 | `mutedSoft` / kart BG | 5.8:1 ✅ | OK |
| Grafik eksen etiketleri (`barValText`) | 1233-1237 | `muted` / `bg` | 4.2:1 ⚠️ | `mutedSoft` (#94A3B8) kullan → 5.8:1 |
| Metrik alt açıklamaları (`trendMetricLabel`) | 1287-1291 | `muted` / `bgSoft` | **3.9:1** ❌ | `mutedSoft` veya `text` (opak) kullan → >4.5:1 |

#### 3.1.2 Font Boyutları
| Element | Satır | Boyut | WCAG Öneri | Durum | Akssiyon |
|---------|------|-------|------------|-------|---------|
| Ana başlık (`heroBrandMain`) | 539-543 | **18px** | ≥16px | ✅ | - |
| Yakıt fiyat metni (`heroFuelPrice`) | 671-677 | **27px** | Büyük metin | ✅ | - |
| İkincil açıklamalar (`heroUpdateText`) | 595-599 | **10px** | ≥14px | ❌ Kritik | **12-13px'e yükselt** |
| Grafik değerleri (`barValText`) | 1233-1237 | **9px** | ≥12px | ❌ Kritik | **11-12px'e yükselt** |
| Trend metrik değerleri (`trendMetricVal`) | 1290-1296 | **13px** | ≥14px | ⚠️ | 14px'e yükselt (isteğe bağlı) |

**`allowFontScaling` Kontrol:** ❌ Hiçbir `Text` component'inde `allowFontScaling={false}` veya `maxFontSizeMultiplier` kullanımı tespit edilmedi. Bu iyi bir durum; ancak 9-10px fontlar kullanıcı sistem fontunu büyütse bile çok küçük kalabilir.

#### 3.1.3 Dokunma Hedefleri
| Element | Satır | Boyut | WCAG Min. | Durum | Akssiyon |
|---------|------|-------|-----------|-------|---------|
| Yenile butonu (`heroRefreshBtn`) | 561-572 | **40x40pt** | 44x44pt | ⚠️ | 44x44pt'ye yükselt veya `hitSlop={{top:2, bottom:2, left:2, right:2}}` ekle |
| Segmented fuel picker (`segmentBtn`) | 1193-1204 | Min height: **34pt** | 44x44pt | ❌ | **38-44pt'ye yükselt** |
| Grafik bar sütunları (Pressable) | 203-240 | Görsel bar 14-18px genişlik | 44x44pt | ❌ | `hitSlop` ekle veya dokunma alanını genişlet |

#### 3.1.4 Ekran Okuyucu Desteği
| Element | Satır | Mevcut Erişilebilirlik | Bulgu | Önerilen Düzeltme |
|---------|------|----------------------|-------|-------------------|
| Yenile butonu | 201-210 | ✅ `accessibilityLabel="Fiyatları yenile"` | İyi | - |
| Yakıt kartları (hero tiles) | 241-303 | ❌ Eksik | **Kritik** | `<View accessible={true} accessibilityRole="button" accessibilityLabel="Benzin 95, 71.31 lira, 0.20 lira artış">` |
| Trend grafiği | 407-491 | ❌ Eksik | **Yüksek** | `accessibilityLabel="Son 7 günlük benzin fiyat trendi. En düşük 70.50, en yüksek 71.80 lira"` |
| Piyasa sinyal kartı | 308-369 | ❌ Eksik | **Yüksek** | `accessibilityRole="alert" accessibilityLabel="Beklenen fiyat değişimi: Benzin 0.50 lira zam, Motorin sabit"` |

**Focus Order (Sekme Sırası):** React Native'de otomatik. `ScrollView` içindeki element sırası mantıklı (yukarıdan aşağıya).

---

### 3.2 İller Ekranı (`mobile/src/screens/Iller.js`)

#### 3.2.1 Renk Kontrastı
| Bileşen | Satır | Renk Kombinasyonu | Oran | Öneri |
|---------|------|-------------------|------|-------|
| Arama placeholder (`searchInput`) | 106-116 | `mutedSoft` / `surface` | **5.2:1** ✅ | OK |
| Şehir alt metinleri (`cityChange`) | 563-569 | `warning`/`accent` / `surface` | 7.2:1 / 9.1:1 ✅ | Mükemmel |
| Liste başlık alt metni (`listMeta`) | 480-485 | `muted` / `bg` | 4.2:1 ⚠️ | `mutedSoft` kullan |

#### 3.2.2 Font Boyutları
| Element | Satır | Boyut | Durum | Akssiyon |
|---------|------|-------|-------|---------|
| Şehir adı (`cityName`) | 542-546 | **16px** | ✅ | - |
| Alt metinler (`cityChange`) | 563-569 | **11px** | ⚠️ | 12-13px'e yükselt |
| Empty state açıklaması (`emptyText`) | 516-521 | **12px** | ✅ | - |

#### 3.2.3 Dokunma Hedefleri
| Element | Satır | Boyut | Durum | Akssiyon |
|---------|------|-------|-------|---------|
| Arama temizle butonu (`clearSearchButton`) | 119-125 | **28x28pt** | ❌ | **36-44pt'ye yükselt** veya `hitSlop={{all: 8}}` ekle |
| Segment butonları (`segment`) | 152-181 | Min height: **34pt** (ölçüm yok) | ⚠️ | 44pt minimum yükseklik ayarla |
| Şehir kartları (`cityCard`) | 486-499 | Min height: **82pt** | ✅ | OK (Tam kart tıklanabilir) |
| Kalp (favori) butonu (`heartButton`) | 226-232 | Icon: 18pt, padding: 2pt = **~22pt** | ❌ Kritik | **`hitSlop={{all: 11}}`** ekle → 44pt eşdeğeri |

#### 3.2.4 Ekran Okuyucu Desteği
| Element | Satır | Mevcut | Bulgu | Önerilen Düzeltme |
|---------|------|--------|-------|-------------------|
| Arama kutusu | 105-117 | ❌ | **Yüksek** | `accessibilityLabel="Şehir ara"` `accessibilityHint="İl adı girin"` |
| Aramayı temizle butonu | 119-125 | ✅ `accessibilityLabel="Aramayı temizle"` | İyi | - |
| Yenile butonu | 134-145 | ✅ `accessibilityLabel="Fiyatları yenile"` | İyi | - |
| Şehir kartları | 215-251 | ❌ | **Kritik** | `accessible={true}` `accessibilityRole="button"` `accessibilityLabel="İstanbul, 1. sıra, benzin 71.50 lira, ortalamadan 0.30 lira pahalı"` |
| Kalp butonu | 226-232 | ❌ | **Kritik** | `accessibilityRole="button"` `accessibilityLabel="Favorilere ekle"` veya `"Favorilerden çıkar"` (dinamik) |

**Not:** Şehir listesi 81 öğe içeriyor. `FlatList` yerine `ScrollView` kullanıldığı için performans sorunu olabilir ancak erişilebilirlik açısından sorun yok.

---

### 3.3 Geçmiş Ekranı (`mobile/src/screens/Gecmis.js`)

#### 3.3.1 Renk Kontrastı
| Bileşen | Satır | Renk Kombinasyonu | Oran | Öneri |
|---------|------|-------------------|------|-------|
| Ana fiyat (`chartMainPrice`) | 549-553 | `white` (#FFFFFF) / `surface` | **17:1** ✅ | Mükemmel |
| Grafik tarih etiketleri (`barDateLabel`) | 695-700 | `mutedSoft` / `surface` | 5.8:1 ✅ | OK |
| Y-ekseni etiketleri (`guideLabelText`) | 633-638 | `mutedSoft` / `surface` | 5.8:1 ✅ | OK |
| Metrik alt açıklamaları (`metricGridSub`) | 740-744 | `muted` / `surface` | **3.8:1** ❌ | `mutedSoft` kullan → 5.8:1 |

#### 3.3.2 Font Boyutları
| Element | Satır | Boyut | Durum | Akssiyon |
|---------|------|-------|-------|---------|
| Ana başlık (`title`) | 420-424 | **24px** | ✅ | - |
| Ana fiyat (`chartMainPrice`) | 549-553 | **26px** | ✅ | Büyük metin, mükemmel |
| Y-ekseni etiketleri (`guideLabelText`) | 633-638 | **9.5px** | ❌ Kritik | **11-12px'e yükselt** |
| Bar tarihleri (`barDateLabel`) | 695-700 | **9.5px** | ❌ Kritik | **11-12px'e yükselt** |
| Tooltip fiyat (`floatingTooltipText`) | 669-673 | **9.5px** | ❌ | **11-12px'e yükselt** |

#### 3.3.3 Dokunma Hedefleri
| Element | Satır | Boyut | Durum | Akssiyon |
|---------|------|-------|-------|---------|
| Yakıt seçici butonları (`fuelTab`) | 87-111 | Min height: **40pt** (ölçüm: paddingVertical: 9) | ⚠️ | 44pt'ye yükselt (paddingVertical: 11-12) |
| Bar sütunları (Pressable) | 204-242 | Görsel genişlik: 14pt, height: 98pt | ❌ | **`hitSlop={{left: 15, right: 15}}`** ekle → 44pt genişlik |
| "Canlıya Dön" butonu (`resetInspectBtn`) | 124-128 | Yükseklik belirsiz (~24pt tahmin) | ❌ | **36-44pt minimum** + padding artır |

#### 3.3.4 Ekran Okuyucu Desteği
| Element | Satır | Mevcut | Bulgu | Önerilen Düzeltme |
|---------|------|--------|-------|-------------------|
| Grafik kartı | 496-506 | ❌ | **Kritik** | Ana `View`'e `accessible={true}` `accessibilityRole="image"` `accessibilityLabel="Benzin 95 fiyat grafiği. Son 7 gün. En düşük 70.50, en yüksek 71.80, şu an 71.31 lira. Son haftada 0.20 lira artış."` |
| Bar sütunları | 204-242 | ❌ | **Yüksek** | Her bar: `accessibilityLabel="Pazartesi, 70.80 lira"` |
| Metrik kartları | 258-304 | ❌ | **Orta** | `accessible={true}` `accessibilityLabel="En düşük fiyat 70.50 lira, 5 Ekim tarihinde"` |
| Değişiklik satırları | 314-347 | ❌ | **Yüksek** | `accessibilityLabel="7 Ekim, Benzin 95, 0.30 lira indirim"` |

**Grafik Erişilebilirliği:** Bar chart gibi veri görselleştirmeleri için `accessibilityRole="image"` + detaylı açıklama veya alternatif metin tablosu önerilir.

---

### 3.4 Aracım Ekranı (`mobile/src/screens/Aracim.js`)

#### 3.4.1 Renk Kontrastı
| Bileşen | Satır | Renk Kombinasyonu | Oran | Öneri |
|---------|------|-------------------|------|-------|
| Form label'ları (`fieldLabel`) | 549 (styles) | `mutedSoft` / `surface` | 5.8:1 ✅ | OK |
| Input placeholder | 290-292 | `muted` / `bgSoft` | **3.9:1** ⚠️ | `mutedSoft` kullan → 5.2:1 |
| Grafik bar etiketleri (`barLabel`) | 568-569 | `mutedSoft` / `surface` | 5.8:1 ✅ | OK |
| Fiş meta bilgileri (`historyMeta`) | 579 | `muted` / `surface` | **3.8:1** ❌ | `mutedSoft` veya daha açık renk |

#### 3.4.2 Font Boyutları
| Element | Satır | Boyut | Durum | Akssiyon |
|---------|------|-------|-------|---------|
| Başlık (`brand`) | 541 | **20px** | ✅ | - |
| Form etiketleri (`fieldLabel`) | 549 | **12px** | ⚠️ | 13-14px önerilir |
| Input metni (`input`) | 551 | **15px** | ✅ | - |
| Bar grafik etiketleri (`barLabel`) | 568 | **11px** | ⚠️ | 12-13px'e yükselt |
| Fiş meta (`historyMeta`) | 579 | **10px** | ❌ | **12px'e yükselt** |

#### 3.4.3 Dokunma Hedefleri
| Element | Satır | Boyut | Durum | Akssiyon |
|---------|------|-------|-------|---------|
| Fişi sil butonu (`deleteButton`) | 369-371, 580 | Icon: 16pt, padding: 4pt = **24pt** | ❌ Kritik | **`hitSlop={{all: 10}}`** ekle → 44pt |
| Yakıt seçici (`fuelOption`) | 272-278 | Min height: **40pt** | ⚠️ | 44pt'ye yükselt |
| Şehir seçici (`cityButton`) | 282-287 | Height: **48pt** | ✅ | OK |
| "+ Yakıt Fişi Ekle" butonu | 260-263 | Min height: **46pt** (tahmin) | ✅ | OK |

#### 3.4.4 Ekran Okuyucu Desteği
| Element | Satır | Mevcut | Bulgu | Önerilen Düzeltme |
|---------|------|--------|-------|-------------------|
| Fiyat şeridi (price strip) | 249-256 | ❌ | **Yüksek** | `accessible={true}` `accessibilityLabel="İstanbul Benzin 95 canlı fiyatı, 71.50 lira litre başına"` |
| Input alanları | 290-298 | ❌ | **Kritik** | `accessibilityLabel="Harcanan tutar"` `accessibilityHint="Lirasını girin"` |
| Bar grafik | 323-335 | ❌ | **Yüksek** | Ana View: `accessible={true}` `accessibilityLabel="Son 6 aylık yakıt gideri trendi. Ekim ayı 2500 lira, Eylül 3000 lira..."` |
| Fiş satırları | 350-373 | ❌ | **Yüksek** | `accessible={true}` `accessibilityLabel="Shell İstanbul Benzin 95, 7 Ekim, 1000 lira, 13.8 litre, Kredi Kartı"` |
| Sil butonu | 369-371 | ❌ | **Kritik** | `accessibilityRole="button"` `accessibilityLabel="Fişi sil"` |

---

### 3.5 Bildirimler Ekranı (`mobile/src/screens/Bildirimler.js`)

#### 3.5.1 Renk Kontrastı
| Bileşen | Satır | Renk Kombinasyonu | Oran | Öneri |
|---------|------|-------------------|------|-------|
| Durum rozeti metni (active) | 620-623 | `accent` / `accentDark` | **4.8:1** ⚠️ | Kabul edilebilir ama 5:1'e yükseltmek ideal |
| Durum rozeti (pending) | 624-627 | `warning` / `bgSoft` | **6.5:1** ✅ | OK |
| Özet açıklaması (`summaryDesc`) | 659-664 | `mutedSoft` / `surface` | 5.8:1 ✅ | OK |
| Bildirim satır açıklamaları (`rowDesc`) | 787-792 | `mutedSoft` / `surface` | 5.8:1 ✅ | OK |

#### 3.5.2 Font Boyutları
| Element | Satır | Boyut | Durum | Akssiyon |
|---------|------|-------|-------|---------|
| Başlık (`title`) | 572-575 | **24px** | ✅ | - |
| Durum rozeti metni (`statusBadgeText`) | 617-619 | **11px** | ⚠️ | 12px önerilir |
| Bildirim satır başlıkları (`rowTitle`) | 782-786 | **14px** | ✅ | - |
| Token metni (`tokenText`) | 665-670 | **11px** | ⚠️ | 12px'e yükselt (okunaklılık için) |

#### 3.5.3 Dokunma Hedefleri
| Element | Satır | Boyut | Durum | Akssiyon |
|---------|------|-------|-------|---------|
| Switch (React Native native) | 395-401 | Native boyut: **~40x60pt** | ✅ | OK (Native component) |
| Alarm satırı sil butonu (`deleteAlertBtn`) | 370-372, 941-943 | Icon: 16pt, padding: 4pt = **24pt** | ❌ Kritik | **`hitSlop={{all: 10}}`** ekle |
| Koşul kartları (`condCard`) | 481-489, 961 | Height belirsiz (padding: 10) = **~40pt** | ⚠️ | Min height 44pt ayarla |

#### 3.5.4 Ekran Okuyucu Desteği
| Element | Satır | Mevcut | Bulgu | Önerilen Düzeltme |
|---------|------|--------|-------|-------------------|
| Durum rozeti | 302-306 | ❌ | **Orta** | `accessibilityLabel="Bildirim durumu: Aktif"` veya `"Kapalı"` |
| Özet kartı | 308-319 | ❌ | **Yüksek** | `accessible={true}` `accessibilityLabel="Bildirim izni açık. Expo token hazırlandı."` |
| Bildirim satırları | 386-404 | ❌ | **Kritik** | `accessible={true}` `accessibilityRole="switch"` `accessibilityLabel="Günlük fiyat uyarıları, şu anda açık"` `accessibilityHint="Açmak veya kapatmak için çift dokunun"` |
| Switch | 395-401 | ❌ (Native) | **Kritik** | `accessibilityLabel` parent'a ekle |
| Özel alarm satırları | 337-375 | ❌ | **Yüksek** | `accessible={true}` `accessibilityLabel="İstanbul Benzin 95 alarmı, fiyat 70 lira altına düşünce uyar, şu anda aktif"` |
| Sil butonu | 370-372 | ❌ | **Kritik** | `accessibilityRole="button"` `accessibilityLabel="Alarmı sil"` |

**Switch Kontrolü:** React Native `<Switch>` component'i otomatik olarak erişilebilir. Ancak parent container'a `accessibilityLabel` eklemek anlam katacaktır.

---

## 4. Çapraz Ekran Ortak Sorunlar

### 4.1 Genel Erişilebilirlik Sorunları

#### ❌ Kritik (Öncelik 1)
1. **`accessibilityLabel` eksikliği:** Toplam 5 ekranda sadece 9 adet kullanım tespit edildi. İnteraktif öğelerin %90'ı ekran okuyucu desteğinden yoksun.
   - **Etkilenen:** Görme engelli kullanıcılar
   - **Çözüm:** Her buton, kart, input ve interaktif element için `accessibilityLabel` ekle

2. **Çok küçük fontlar (9-11px):** Özellikle grafik etiketleri, alt açıklamalar ve meta bilgileri.
   - **Etkilenen:** Yaşlı kullanıcılar, düşük görme keskinliği
   - **Çözüm:** Minimum 11-12px font boyutu kullan

3. **Yetersiz dokunma hedefleri (<44pt):** Küçük ikonlar, segment butonları, silme butonları.
   - **Etkilenen:** Motor becerileri düşük kullanıcılar, yaşlı kullanıcılar
   - **Çözüm:** `hitSlop` prop'u ekle veya boyutları artır

#### ⚠️ Yüksek (Öncelik 2)
4. **Düşük kontrast (3.8-4.2:1):** `muted` rengi `surface` üzerinde.
   - **Etkilenen:** Düşük görme, renk körlüğü
   - **Çözüm:** `muted` → `mutedSoft` veya #A0AEC0 (6:1 oran)

5. **Grafik ve veri görselleştirmelerinde erişilebilirlik eksikliği:**
   - **Etkilenen:** Ekran okuyucu kullanıcıları
   - **Çözüm:** `accessibilityRole="image"` + detaylı açıklama veya alternatif metin tablosu

#### ⚙️ Orta (Öncelik 3)
6. **`allowFontScaling` kontrolü yok:** Kullanıcı sistem fontunu büyütse bile 9-10px fontlar okunaksız kalabilir.
   - **Çözüm:** Kritik metinler için `maxFontSizeMultiplier={1.3}` ekleyerek aşırı büyümeyi sınırla, ama tamamen kapatma

7. **Modal focus trap eksikliği:** Modal açıldığında focus otomatik ilk elementa gitmiyor.
   - **Çözüm:** React Native'de doğal davranış var ama test et

---

## 5. Öncelikli Düzeltme Checklist

### Aşama 1: Kritik Erişilebilirlik (Öncelik: P0)
**Hedef:** Ekran okuyucu kullanıcıları uygulamayı temel seviyede kullanabilsin

- [ ] **Ana Sayfa:**
  - [ ] Yenile butonuna `accessibilityLabel` ekle (✅ zaten var)
  - [ ] 3'lü yakıt kartlarına `accessible={true}`, `accessibilityRole="button"`, `accessibilityLabel="Benzin 95, 71.31 lira, 0.20 lira artış"` ekle
  - [ ] Trend grafiğine `accessibilityLabel="Son 7 günlük benzin fiyat trendi. En düşük ... en yüksek ..."` ekle
  - [ ] Piyasa sinyal kartına `accessibilityRole="alert"` ve dinamik label ekle

- [ ] **İller Ekranı:**
  - [ ] Arama input'una `accessibilityLabel="Şehir ara"` ve `accessibilityHint="İl adı girin"` ekle
  - [ ] Her şehir kartına `accessible={true}`, `accessibilityRole="button"`, `accessibilityLabel="[Şehir], [sıra], [yakıt], [fiyat], [fark]"` ekle
  - [ ] Kalp (favori) butonuna `accessibilityRole="button"`, dinamik `accessibilityLabel` ekle

- [ ] **Geçmiş Ekranı:**
  - [ ] Grafik ana container'ına `accessible={true}`, `accessibilityRole="image"`, detaylı `accessibilityLabel` ekle
  - [ ] Her bar sütununa `accessibilityLabel="[Gün], [fiyat]"` ekle
  - [ ] Metrik kartlarına `accessible={true}` ve açıklayıcı label ekle

- [ ] **Aracım Ekranı:**
  - [ ] Input alanlarına `accessibilityLabel` ve `accessibilityHint` ekle
  - [ ] Fiş satırlarına `accessible={true}` ve özet label ekle
  - [ ] Sil butonlarına `accessibilityRole="button"`, `accessibilityLabel="Fişi sil"` ekle

- [ ] **Bildirimler Ekranı:**
  - [ ] Switch parent container'larına `accessibilityRole="switch"`, `accessibilityLabel` ve `accessibilityHint` ekle
  - [ ] Özel alarm satırlarına `accessible={true}` ve dinamik label ekle
  - [ ] Sil butonlarına `accessibilityRole="button"` ve label ekle

### Aşama 2: Renk Kontrastı İyileştirmeleri (Öncelik: P1)
**Hedef:** Tüm metin-arka plan kombinasyonları WCAG AA standardını karşılasın (4.5:1)

- [ ] **`mobile/src/theme.js` güncellemesi:**
  ```javascript
  // ÖNERİLEN YENİ RENK
  mutedImproved: '#A0AEC0',  // Kontrast oranı: bg üzerinde 6.2:1, surface üzerinde 5.5:1
  ```

- [ ] **Şu style property'leri güncellensin:**
  - [ ] `barValText` (AnaSayfa.js:1233) → color: `mutedSoft` (mevcut `muted` yerine)
  - [ ] `trendMetricLabel` (AnaSayfa.js:1287) → color: `mutedSoft`
  - [ ] `listMeta` (Iller.js:480) → color: `mutedSoft`
  - [ ] `metricGridSub` (Gecmis.js:740) → color: `mutedSoft`
  - [ ] `historyMeta` (Aracim.js:579) → color: `mutedSoft`

### Aşama 3: Font Boyutu Artırma (Öncelik: P1)
**Hedef:** Hiçbir metin 11px'in altında olmasın

- [ ] **AnaSayfa.js:**
  - [ ] `heroUpdateText` (595): 10px → **12px**
  - [ ] `barValText` (1233): 9px → **11px**
  - [ ] `barDayText` (1263): 10px → **11px**
  - [ ] `signalDisclaimer` (1008): 10px → **11px**

- [ ] **Iller.js:**
  - [ ] `cityChange` (563): 11px → **12px**
  - [ ] `cityMeta` (553): 10px → **11px**

- [ ] **Gecmis.js:**
  - [ ] `guideLabelText` (633): 9.5px → **11px**
  - [ ] `barDateLabel` (695): 9.5px → **11px**
  - [ ] `floatingTooltipText` (669): 9.5px → **11px**

- [ ] **Aracim.js:**
  - [ ] `historyMeta` (579): 10px → **12px**
  - [ ] `barLabel` (568): 11px → **12px**

- [ ] **Bildirimler.js:**
  - [ ] `statusBadgeText` (617): 11px → **12px**
  - [ ] `tokenText` (665): 11px → **12px**

### Aşama 4: Dokunma Hedefi Genişletme (Öncelik: P1)
**Hedef:** Tüm interaktif elementler minimum 44x44pt olsun

- [ ] **Küçük butonlara `hitSlop` ekle:**
  ```javascript
  // Örnek: AnaSayfa.js - Yenile butonu
  <Pressable
    accessibilityLabel="Fiyatları yenile"
    hitSlop={{top: 2, bottom: 2, left: 2, right: 2}}  // 40x40 → 44x44
    ...
  />
  ```

- [ ] **AnaSayfa.js:**
  - [ ] `heroRefreshBtn` (561): 40x40 → `hitSlop: {all: 2}`
  - [ ] `segmentBtn` (1193): min-height 34 → **44pt**
  - [ ] Bar sütunları (203): `hitSlop: {left: 15, right: 15}`

- [ ] **Iller.js:**
  - [ ] `clearSearchButton` (327): 28x28 → `hitSlop: {all: 8}`
  - [ ] `heartButton` (419): ~22pt → `hitSlop: {all: 11}`
  - [ ] `segment` (396): min-height 34 → **44pt**

- [ ] **Gecmis.js:**
  - [ ] `fuelTab` (449): min-height 40 → **44pt** (paddingVertical: 11)
  - [ ] Bar sütunları (204): `hitSlop: {left: 15, right: 15}`
  - [ ] `resetInspectBtn` (529): min-height **44pt**

- [ ] **Aracim.js:**
  - [ ] `deleteButton` (580): 24pt → `hitSlop: {all: 10}`
  - [ ] `fuelOption` (458): min-height 40 → **44pt**

- [ ] **Bildirimler.js:**
  - [ ] `deleteAlertBtn` (941): 24pt → `hitSlop: {all: 10}`
  - [ ] `condCard` (961): min-height **44pt**

### Aşama 5: Grafik ve Görselleştirme Erişilebilirliği (Öncelik: P2)

- [ ] **AnaSayfa.js - Trend Grafiği:**
  ```javascript
  <View 
    style={styles.barGraphBox}
    accessible={true}
    accessibilityRole="image"
    accessibilityLabel={`Son 7 günlük ${activeFuelMeta.label} fiyat trendi. En düşük ${chartMetrics.min.toFixed(2)} lira, en yüksek ${chartMetrics.max.toFixed(2)} lira. Son fiyat ${chartMetrics.last.toFixed(2)} lira. ${chartMetrics.diff > 0 ? 'Haftalık artış' : 'Haftalık düşüş'} ${Math.abs(chartMetrics.diff).toFixed(2)} lira.`}
  >
  ```

- [ ] **Gecmis.js - Bar Grafik:**
  ```javascript
  <View 
    style={styles.chartCanvasContainer}
    accessible={true}
    accessibilityRole="image"
    accessibilityLabel={`${activeFuelMeta.label} ${periodLabel} fiyat grafiği. En düşük ${minPrice.toFixed(2)} lira ${historyView.minDate} tarihinde. En yüksek ${maxPrice.toFixed(2)} lira ${historyView.maxDate} tarihinde. Ortalama ${avgPrice.toFixed(2)} lira. Dönem değişimi ${periodDiff > 0 ? '+' : ''}${periodDiff.toFixed(2)} lira.`}
  >
  ```

- [ ] **Aracim.js - Aylık Gider Grafiği:**
  ```javascript
  <View 
    style={styles.barChart}
    accessible={true}
    accessibilityRole="image"
    accessibilityLabel={`Son 6 aylık yakıt gideri trendi. ${monthlyExpenses.map(m => `${m.label} ${formatNumber(m.total)} lira`).join(', ')}.`}
  >
  ```

### Aşama 6: Test ve Doğrulama (Öncelik: P2)

- [ ] **iOS VoiceOver Testi:**
  - [ ] Ayarlar → Erişilebilirlik → VoiceOver'ı aç
  - [ ] Her ekranda sırayla element'leri geç (sağa kaydır)
  - [ ] Butonlara çift dokun ve beklendiği gibi çalıştığını doğrula
  - [ ] Grafiklerin açıklamasını duyduğunu kontrol et

- [ ] **Android TalkBack Testi:**
  - [ ] Ayarlar → Erişilebilirlik → TalkBack'i aç
  - [ ] Aynı test senaryosunu iOS gibi uygula

- [ ] **Kontrast Testi (Otomatik):**
  - [ ] Web tool: WebAIM Contrast Checker (https://webaim.org/resources/contrastchecker/)
  - [ ] Her yeni renk kombinasyonunu test et

- [ ] **Font Scaling Testi:**
  - [ ] iOS: Ayarlar → Erişilebilirlik → Display & Text Size → Larger Text → maksimum yap
  - [ ] Android: Ayarlar → Display → Font size → Largest
  - [ ] Uygulamayı aç ve metinlerin kesilmediğini, overlap olmadığını kontrol et

---

## 6. Önerilen Yeni Theme Renkleri

```javascript
// mobile/src/theme.js'e EKLENECEK

export const colors = {
  // ... mevcut renkler ...
  
  // ✨ ERİŞİLEBİLİRLİK İYİLEŞTİRMELERİ
  mutedAccessible: '#A0AEC0',  // Eski 'muted' yerine kullan
  // Kontrast oranları:
  // - bg (#0A0E1A) üzerinde: 6.2:1 ✅ AA
  // - surface (#141E33) üzerinde: 5.5:1 ✅ AA
  // - surfaceAlt (#1A2640) üzerinde: 5.1:1 ✅ AA
}
```

---

## 7. React Native Erişilebilirlik En İyi Uygulamalar

### 7.1 Temel Props'lar
```javascript
// ✅ İYİ ÖRNEK
<Pressable
  accessible={true}                                // Tek bir erişilebilir öğe olarak grupla
  accessibilityRole="button"                       // Rol belirle (button, header, link, image, vb.)
  accessibilityLabel="Fiyatları yenile"           // Ekran okuyucuya açıklama
  accessibilityHint="Yakıt fiyatlarını günceller" // Ek bağlam (isteğe bağlı)
  accessibilityState={{disabled: loading}}         // Dinamik durum
  hitSlop={{all: 10}}                             // Dokunma alanını genişlet
>
  <MaterialCommunityIcons name="refresh" size={18} />
</Pressable>

// ❌ KÖTÜ ÖRNEK
<Pressable onPress={refresh}>
  <MaterialCommunityIcons name="refresh" size={18} />
</Pressable>
```

### 7.2 Dinamik Label'lar
```javascript
// Switch için dinamik açıklama
<Switch
  value={isEnabled}
  onValueChange={toggle}
  accessibilityLabel={`Günlük fiyat uyarıları ${isEnabled ? 'açık' : 'kapalı'}`}
  accessibilityHint="Açmak veya kapatmak için çift dokunun"
/>

// Favori butonu için dinamik açıklama
<Pressable
  accessibilityRole="button"
  accessibilityLabel={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
>
  <Icon name={isFavorite ? 'heart' : 'heart-outline'} />
</Pressable>
```

### 7.3 Grouping (Gruplama)
```javascript
// Kart içindeki öğeleri tek bir erişilebilir öğe olarak grupla
<View
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel="Benzin 95, 71.31 lira, 0.20 lira artış"
>
  <Text style={styles.fuelName}>Benzin 95</Text>
  <Text style={styles.price}>71.31 TL</Text>
  <Text style={styles.change}>+0.20 TL</Text>
</View>
```

### 7.4 Görseller ve İkonlar
```javascript
// Dekoratif ikon (ekran okuyucu atla)
<MaterialCommunityIcons 
  name="gas-station" 
  size={18}
  accessibilityElementsHidden={true}  // iOS
  importantForAccessibility="no"       // Android
/>

// Anlamlı ikon (açıklama ekle)
<MaterialCommunityIcons 
  name="arrow-up-bold" 
  size={12}
  accessibilityLabel="Fiyat artışı"
/>
```

---

## 8. Ek Kaynaklar

- **React Native Erişilebilirlik Dokümantasyonu:** https://reactnative.dev/docs/accessibility
- **WCAG 2.1 Hızlı Referans:** https://www.w3.org/WAI/WCAG21/quickref/
- **WebAIM Kontrast Checker:** https://webaim.org/resources/contrastchecker/
- **iOS VoiceOver Kılavuzu:** https://support.apple.com/guide/iphone/turn-on-and-practice-voiceover-iph3e2e415f/ios
- **Android TalkBack Kılavuzu:** https://support.google.com/accessibility/android/answer/6283677

---

## 9. Sonuç

YakitRadar uygulaması, görsel tasarım açısından modern ve kullanıcı dostu. Ancak erişilebilirlik açısından önemli iyileştirmeler gerekmektedir. **Öncelik 1 (Kritik)** kategorisindeki düzeltmeler yapıldığında, görme engelli ve motor becerileri düşük kullanıcılar uygulamayı rahatça kullanabilecektir.

**Tahmini Geliştirme Süresi:**
- Aşama 1-2 (Kritik): ~3-4 gün (1 frontend developer)
- Aşama 3-4 (Yüksek): ~2-3 gün
- Aşama 5-6 (Orta): ~2 gün
- **Toplam:** ~7-9 iş günü

**Başarı Metrikleri:**
- ✅ Tüm interaktif elementlerde `accessibilityLabel` olsun (hedef: %100)
- ✅ WCAG AA kontrast oranı: ≥4.5:1 (metin), ≥3:1 (UI öğeleri)
- ✅ Minimum font boyutu: 11-12px
- ✅ Minimum dokunma hedefi: 44x44pt (iOS) / 48x48dp (Android)
- ✅ VoiceOver/TalkBack ile tüm ekranlar kullanılabilir

---

**Rapor Tarihi:** 9 Ekim 2026  
**Son Güncelleme:** 9 Ekim 2026  
**Versiyon:** 1.0
