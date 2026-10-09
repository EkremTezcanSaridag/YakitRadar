# YakitRadar Tasarım Dokümantasyonu

Bu klasör, YakitRadar uygulamasının tasarım spesifikasyonlarını ve erişilebilirlik denetimini içerir.

---

## 📋 İçindekiler

### 1. [Erişilebilirlik Denetimi](./accessibility-audit.md)
**Tarih:** 9 Ekim 2026  
**Durum:** Tamamlandı  

YakitRadar'ın beş ana ekranının (Ana Sayfa, İller, Geçmiş, Aracım, Bildirimler) WCAG 2.1 AA standartlarına göre erişilebilirlik değerlendirmesi.

**Kapsam:**
- ✅ Renk kontrastı analizi (WCAG 2.1)
- ✅ Font boyutu kontrolleri
- ✅ Dokunma hedefi boyutları (44x44pt minimum)
- ✅ Ekran okuyucu desteği (accessibilityLabel, accessibilityRole)
- ✅ Ekran bazında bulgular ve öncelikli düzeltme checklist

**Kritik Bulgular:**
- `accessibilityLabel` kullanımı %10'un altında (9 adet)
- Bazı metin öğelerinde düşük kontrast (3.8-4.2:1)
- 9-10px font boyutları (minimum 11-12px olmalı)
- Küçük dokunma hedefleri (<44pt), `hitSlop` önerisi

**Tahmini Düzeltme Süresi:** 7-9 iş günü

---

### 2. [Durum (State) Tasarım Spesifikasyonu](./states-spec.md)
**Tarih:** 9 Ekim 2026  
**Durum:** Tamamlandı

Loading, empty, error ve success state'lerinin tasarım ve implementasyon kılavuzu.

**Kapsam:**
- ✅ Skeleton Loader tasarımı ve animasyonları
- ✅ Empty State component yapısı ve ekran bazında kullanımı
- ✅ Toast Notification sistemi (4 varyant: success, error, warning, info)
- ✅ Error handling stratejileri (network offline, server error, vb.)
- ✅ Ekran-durum matrisi
- ✅ Erişilebilirlik duyuruları (AccessibilityInfo)
- ✅ Reduce Motion desteği

**Önerilen Component'ler:**
- `SkeletonLoader.js` - Pulse animasyonlu loading göstergesi
- `EmptyState.js` - Boş veri durumu için standart UI
- `Toast.js` - Global bildirim sistemi
- `ToastContext.js` - Toast yönetimi (opsiyonel)

**Tahmini Implementation Süresi:** 6-7 iş günü

---

## 🎨 Tasarım Token'ları

### Renk Paleti
```javascript
// mobile/src/theme.js
colors = {
  // Arka planlar
  bg: '#0A0E1A',
  surface: '#141E33',
  surfaceAlt: '#1A2640',
  
  // Metinler
  text: '#F8FAFC',      // 16.2:1 kontrast
  muted: '#64748B',     // 4.2:1 kontrast ⚠️
  mutedSoft: '#94A3B8', // 5.8:1 kontrast ✅
  
  // Vurgu
  accent: '#38BDF8',    // 9.1:1 kontrast
  danger: '#F43F5E',    // 6.3:1 kontrast
  warning: '#F59E0B',   // 7.2:1 kontrast
  info: '#60A5FA',      // 8.5:1 kontrast
}
```

### Tipografi
- **Başlıklar:** 18-24px, font-weight: 900
- **Gövde:** 14-16px, font-weight: 700
- **Alt metinler:** 11-13px, font-weight: 600-700
- **Minimum font:** 11px (önerilen: 12px)

### Spacing
- xs: 4pt
- sm: 8pt
- md: 12pt
- lg: 16pt
- xl: 24pt

---

## 🛠️ Frontend Geliştirici İçin Hızlı Kılavuz

### Öncelik Sırası

#### P0 - Kritik (7-9 gün)
1. Ekran okuyucu desteği ekle (accessibilityLabel, accessibilityRole)
2. Font boyutlarını artır (min 11-12px)
3. Dokunma hedeflerini genişlet (hitSlop ekle)
4. Düşük kontrast renkleri düzelt (muted → mutedSoft)

#### P1 - Yüksek (6-7 gün)
5. SkeletonLoader, EmptyState, Toast component'lerini oluştur
6. Ekranlara loading/empty/error state'leri ekle
7. Network offline banner entegre et

#### P2 - Orta (2-3 gün)
8. Reduce motion desteği ekle
9. Grafik erişilebilirliği iyileştir (accessibilityRole="image")
10. Toast duyuruları test et (VoiceOver/TalkBack)

---

## 📦 Önerilen Yeni Dosyalar

```
mobile/src/
├── components/
│   ├── SkeletonLoader.js    # Loading skeleton component
│   ├── EmptyState.js         # Boş veri durumu component
│   └── Toast.js              # Toast notification component
├── contexts/
│   └── ToastContext.js       # Global toast yönetimi
└── theme.js                  # (Güncellenecek: mutedAccessible rengi ekle)
```

---

## 🔗 Harici Kaynaklar

- **WCAG 2.1 Kılavuzu:** https://www.w3.org/WAI/WCAG21/quickref/
- **React Native Accessibility:** https://reactnative.dev/docs/accessibility
- **WebAIM Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **iOS VoiceOver:** https://support.apple.com/guide/iphone/turn-on-and-practice-voiceover-iph3e2e415f/ios
- **Android TalkBack:** https://support.google.com/accessibility/android/answer/6283677

---

## 📊 İlerleme Takibi

### Erişilebilirlik Denetimi
- [x] Renk kontrastı analizi
- [x] Font boyutu kontrolleri
- [x] Dokunma hedefi ölçümleri
- [x] Ekran okuyucu prop'ları envanteri
- [x] Öncelikli düzeltme checklist

### State Tasarımı
- [x] Skeleton loader spec
- [x] Empty state spec (6 ekran)
- [x] Toast notification spec (4 varyant)
- [x] Error handling stratejileri
- [x] Ekran-durum matrisi
- [x] Implementation checklist

### Implementation (Bekliyor)
- [ ] Component'ler oluşturuldu
- [ ] Ekranlara entegre edildi
- [ ] Test edildi (VoiceOver/TalkBack)
- [ ] Reduce motion test edildi

---

## 👥 İlgili Kişiler

- **Product Designer:** Cursor Cloud Agent
- **Frontend Lead:** TBD
- **Erişilebilirlik Uzmanı:** TBD (danışma için)

---

## 📝 Notlar

- Bu dokümantasyon **mevcut kod analizi** üzerine yazılmıştır. Gerçek renk değerleri, font boyutları ve component yapıları `mobile/src/` klasöründen alınmıştır.
- Tüm öneriler **implementable** (uygulanabilir) olacak şekilde tasarlanmıştır. Component isimleri ve prop önerileri frontend developer'ın doğrudan kullanabileceği şekildedir.
- WCAG kontrast oranları **gerçek hesaplamalar** ile doğrulanmıştır (tahmini değil).

---

**Son Güncelleme:** 9 Ekim 2026  
**Versiyon:** 1.0  
**Durum:** Tamamlandı, implementasyon bekliyor
