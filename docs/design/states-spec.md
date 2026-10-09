# YakitRadar Durum (State) Tasarım Spesifikasyonu

**Tarih:** 9 Ekim 2026  
**Platform:** React Native / Expo  
**Hedef:** Loading, Empty, Error ve Success state'lerinin tutarlı implementasyonu  
**Tasarımcı:** Product Design Agent

---

## 1. Genel Bakış

Bu doküman, YakitRadar uygulamasının beş ana ekranında (Ana Sayfa, İller, Geçmiş, Aracım, Bildirimler) kullanılacak **loading (yükleniyor)**, **empty (boş veri)**, **error (hata)** ve **success (başarı)** durumlarının tasarım spesifikasyonlarını içerir.

**Tasarım İlkeleri:**
- ✨ **Tutarlılık:** Tüm ekranlarda aynı görsel dil ve animasyonlar
- 🎯 **Netlik:** Kullanıcı hangi durumda olduğunu hemen anlasın
- 🚀 **Performans:** Hafif animasyonlar, reduce-motion desteği
- ♿ **Erişilebilirlik:** Ekran okuyucu duyuruları, alternatif geri bildirimler

---

## 2. Mevcut Tema Değerleri

### 2.1 Renk Paleti (`mobile/src/theme.js`)

```javascript
export const colors = {
  // Arka planlar
  bg: '#0A0E1A',           // Ana arka plan
  bgSoft: '#10172A',       // İkincil arka plan
  surface: '#141E33',      // Kart arka planları
  surfaceAlt: '#1A2640',   // Alternatif yüzeyler
  
  // Metinler
  text: '#F8FAFC',         // Ana metin (Kontrast: 16.2:1 ✅)
  muted: '#64748B',        // İkincil metin (Kontrast: 4.2:1 ⚠️)
  mutedSoft: '#94A3B8',    // Üçüncül metin (Kontrast: 5.8:1 ✅)
  
  // Vurgu renkleri
  accent: '#38BDF8',       // Birincil mavi (Kontrast: 9.1:1 ✅)
  accentDark: '#0C2A4A',   // Accent arka plan
  accentSoft: '#38BDF81A', // Accent %10 opacity
  
  danger: '#F43F5E',       // Hata (Kontrast: 6.3:1 ✅)
  dangerDark: '#3A0D18',   // Danger arka plan
  warning: '#F59E0B',      // Uyarı (Kontrast: 7.2:1 ✅)
  warningDark: '#382200',  // Warning arka plan
  info: '#60A5FA',         // Bilgi (Kontrast: 8.5:1 ✅)
  
  // Kenarlar
  border: '#233252',       // Kenar çizgileri
  borderLight: '#2D3E66',  // Açık kenar çizgileri
}
```

### 2.2 Tipografi
```javascript
// Başlıklar
title: { fontSize: 24, fontWeight: '900', color: colors.text }
subtitle: { fontSize: 13, fontWeight: '700', color: colors.mutedSoft }

// Gövde
bodyLarge: { fontSize: 16, fontWeight: '700', color: colors.text }
bodyRegular: { fontSize: 14, fontWeight: '700', color: colors.text }
bodySmall: { fontSize: 12, fontWeight: '700', color: colors.mutedSoft }

// Açıklamalar
caption: { fontSize: 11, fontWeight: '600', color: colors.muted }
```

### 2.3 Spacing (Boşluklar)
```javascript
// Mevcut kullanımdan çıkarılan boşluklar
spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
}
```

---

## 3. Loading States (Yükleniyor Durumu)

### 3.1 Skeleton Loader Tasarımı

#### 3.1.1 Genel Yapı
```javascript
// ÖNERİLEN YENİ COMPONENT: mobile/src/components/SkeletonLoader.js

import { useEffect, useRef } from 'react'
import { Animated, View, StyleSheet } from 'react-native'
import { colors } from '../theme'

export function SkeletonLoader({ 
  width = '100%', 
  height = 16, 
  borderRadius = 6,
  style 
}) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [opacity])

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
      accessible={false}
      importantForAccessibility="no"
    />
  )
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surfaceAlt,  // #1A2640
  },
})
```

#### 3.1.2 Animasyon Özellikleri
- **Süre:** 1600ms (800ms fade-in + 800ms fade-out)
- **Easing:** Linear (varsayılan)
- **Opacity aralığı:** 0.3 - 0.7
- **Loop:** Sonsuz
- **Reduce Motion desteği:**
  ```javascript
  import { AccessibilityInfo } from 'react-native'
  
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false)
  
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled)
  }, [])
  
  // reduceMotionEnabled === true ise animasyonu durdur, sabit opacity 0.5 kullan
  ```

#### 3.1.3 Ana Renk
- **Skeleton arka plan:** `surfaceAlt` (#1A2640)
- **Kontrast (bg üzerinde):** 1.5:1 (dekoratif öğe, yeterli)

### 3.2 Ekran Bazında Skeleton Kullanımı

#### 3.2.1 Ana Sayfa - Hero Fiyat Kartları

**Durum:** İlk yükleme veya manuel refresh

```javascript
// AnaSayfa.js - loading={true} durumunda

{loading ? (
  <View style={styles.fuelCarouselScroll}>
    {[1, 2, 3].map((_, index) => (
      <View key={index} style={styles.heroFuelTileSkeleton}>
        <View style={styles.heroFuelTop}>
          <SkeletonLoader width={80} height={20} />
          <SkeletonLoader width={50} height={16} />
        </View>
        <SkeletonLoader width={120} height={32} style={{ marginVertical: 8 }} />
        <View style={styles.heroFuelFooter}>
          <SkeletonLoader width={90} height={10} />
          <SkeletonLoader width={60} height={12} />
        </View>
      </View>
    ))}
  </View>
) : (
  // Gerçek veri
)}
```

**Boyutlar:**
- Kart: 172x~120pt (mevcut `heroFuelTile` ile aynı)
- Yakıt rozeti skeleton: 80x20pt
- Fiyat skeleton: 120x32pt
- Alt bilgi skeleton: 90x10pt, 60x12pt

#### 3.2.2 Ana Sayfa - 7 Günlük Grafik

**Durum:** Grafik verisi yüklenirken

```javascript
{loading ? (
  <View style={styles.barGraphBox}>
    {[1, 2, 3, 4, 5, 6, 7].map((_, index) => (
      <View key={index} style={styles.barColumn}>
        <SkeletonLoader width={14} height={Math.random() * 50 + 30} borderRadius={7} />
        <SkeletonLoader width={24} height={10} style={{ marginTop: 6 }} />
      </View>
    ))}
  </View>
) : (
  // Gerçek grafik
)}
```

#### 3.2.3 İller Ekranı - Şehir Listesi

**Durum:** Fiyat verisi yüklenirken

```javascript
{loading ? (
  <>
    {[1, 2, 3, 4, 5].map((_, index) => (
      <View key={index} style={styles.cityCardSkeleton}>
        <SkeletonLoader width={36} height={36} borderRadius={8} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonLoader width="60%" height={16} />
          <SkeletonLoader width="80%" height={12} style={{ marginTop: 6 }} />
        </View>
        <SkeletonLoader width={70} height={18} />
      </View>
    ))}
  </>
) : (
  // Gerçek şehir listesi
)}
```

**Boyutlar:**
- Kart: Mevcut `cityCard` ile aynı (min-height: 82pt)
- Rank box skeleton: 36x36pt
- Şehir adı skeleton: %60 genişlik, 16pt yükseklik
- Alt bilgi skeleton: %80 genişlik, 12pt yükseklik
- Fiyat skeleton: 70x18pt

#### 3.2.4 Geçmiş Ekranı - Bar Grafik

**Durum:** Trend verisi yüklenirken

```javascript
{loading ? (
  <View style={styles.barsContainer}>
    {[1, 2, 3, 4, 5, 6, 7].map((_, index) => (
      <View key={index} style={styles.barColumn}>
        <SkeletonLoader width={14} height={Math.random() * 60 + 20} borderRadius={7} />
        <SkeletonLoader width={28} height={10} style={{ marginTop: 6 }} />
      </View>
    ))}
  </View>
) : (
  // Gerçek grafik
)}
```

#### 3.2.5 Aracım Ekranı - Aylık Gider Grafiği

**Durum:** Fiş geçmişi yüklenirken

```javascript
{loading ? (
  <View style={styles.barChart}>
    {[1, 2, 3, 4, 5, 6].map((_, index) => (
      <View key={index} style={styles.barColumn}>
        <SkeletonLoader width={16} height={Math.random() * 70 + 20} borderRadius={6} />
        <SkeletonLoader width={32} height={10} style={{ marginTop: 8 }} />
      </View>
    ))}
  </View>
) : (
  // Gerçek grafik
)}
```

### 3.3 Spinner (Dönen Gösterge) Kullanımı

**Ne zaman skeleton, ne zaman spinner?**
- **Skeleton:** Ekran ilk yükleme, bilinen layout
- **Spinner:** Modal işlemler, kısa asenkron aksiyonlar (kaydet/sil/güncelle)

#### 3.3.1 Spinner Tasarımı

```javascript
// React Native ActivityIndicator kullan (native component)
<ActivityIndicator 
  size="large"          // iOS: 36pt, Android: 48dp
  color={colors.accent} // #38BDF8
  accessibilityLabel="Yükleniyor"
/>
```

**Kullanım Yeri Örnekleri:**
- Modal açılırken (şehir seçici, fiş ekleme)
- "Kaydet" butonuna basıldıktan sonra (Aracım ekranı)
- Backend test bildirimi gönderilirken (Bildirimler ekranı)

#### 3.3.2 Örnek: Buton içinde Spinner

```javascript
<Pressable 
  onPress={handleSave} 
  disabled={saving}
  style={[styles.saveButton, saving && styles.disabled]}
>
  {saving ? (
    <ActivityIndicator size="small" color={colors.bg} />
  ) : (
    <>
      <MaterialCommunityIcons name="check-circle-outline" size={19} color={colors.bg} />
      <Text style={styles.saveButtonText}>Kaydet</Text>
    </>
  )}
</Pressable>
```

### 3.4 Timing Thresholds (Eşik Süreleri)

| Aksiyon | Eşik | Gösterilecek State | Sebep |
|---------|------|-------------------|-------|
| Veri fetch (<200ms) | - | Skeleton gösterme | Çok hızlı, skeleton flaş etkisi yapar |
| Veri fetch (200-500ms) | 200ms | Skeleton göster | Kullanıcı bekliyor, feedback gerekli |
| Veri fetch (>500ms) | 200ms | Skeleton göster | Uzun işlem, kesinlikle feedback gerekli |
| Modal işlem (<500ms) | - | Spinner gösterme | Buton disabled hali yeterli |
| Modal işlem (>500ms) | 300ms | Spinner göster | Kullanıcı feedback bekliyor |

**Implementation örneği:**
```javascript
const [showSkeleton, setShowSkeleton] = useState(false)

useEffect(() => {
  if (loading) {
    const timer = setTimeout(() => setShowSkeleton(true), 200)
    return () => clearTimeout(timer)
  } else {
    setShowSkeleton(false)
  }
}, [loading])

return showSkeleton ? <Skeleton /> : <Content />
```

---

## 4. Empty States (Boş Veri Durumu)

### 4.1 Genel Empty State Tasarımı

#### 4.1.1 Yapı
```javascript
// ÖNERİLEN YENİ COMPONENT: mobile/src/components/EmptyState.js

export function EmptyState({ 
  icon, 
  iconColor = colors.muted,
  title, 
  description, 
  actionLabel, 
  onActionPress 
}) {
  return (
    <View 
      style={styles.emptyState}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${description}`}
    >
      <View style={styles.emptyIconBox}>
        <MaterialCommunityIcons name={icon} size={48} color={iconColor} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {actionLabel && onActionPress && (
        <Pressable 
          onPress={onActionPress} 
          style={styles.emptyAction}
          accessibilityRole="button"
        >
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    minHeight: 280,
    justifyContent: 'center',
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    color: colors.mutedSoft,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyAction: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '900',
  },
})
```

### 4.2 Ekran Bazında Empty States

#### 4.2.1 Ana Sayfa - Favori Şehir Yok

**Durum:** `favoriteCities.length === 0`

```javascript
<EmptyState
  icon="heart-outline"
  iconColor={colors.danger}
  title="Favori şehir yok"
  description="Şehir listesinden kalp simgesine dokunarak favori ekleyebilirsiniz."
  actionLabel="İller Ekranına Git"
  onActionPress={() => navigation.navigate('İller')}
/>
```

**Copy (Metin):**
- **Başlık:** Favori şehir yok
- **Açıklama:** Şehir listesinden kalp simgesine dokunarak favori ekleyebilirsiniz.
- **Aksiyon:** İller Ekranına Git

#### 4.2.2 İller Ekranı - Arama Sonucu Yok

**Durum:** `searchQuery.length > 0 && filteredCities.length === 0`

```javascript
<EmptyState
  icon="map-search-outline"
  iconColor={colors.accent}
  title="İl bulunamadı"
  description="Arama metnini kısaltarak tekrar deneyin."
  actionLabel="Aramayı Temizle"
  onActionPress={() => setSearchQuery('')}
/>
```

**Copy:**
- **Başlık:** İl bulunamadı
- **Açıklama:** Arama metnini kısaltarak tekrar deneyin.
- **Aksiyon:** Aramayı Temizle

#### 4.2.3 İller Ekranı - Favori Listesi Boş

**Durum:** `showOnlyFavorites === true && favoriteCities.length === 0`

```javascript
<EmptyState
  icon="heart-plus-outline"
  iconColor="#FF4D4D"
  title="Favori şehriniz yok"
  description="Kalp simgesine dokunarak şehirleri favorilere ekleyebilirsiniz."
  actionLabel="Tüm Şehirleri Göster"
  onActionPress={() => setShowOnlyFavorites(false)}
/>
```

**Copy:**
- **Başlık:** Favori şehriniz yok
- **Açıklama:** Kalp simgesine dokunarak şehirleri favorilere ekleyebilirsiniz.
- **Aksiyon:** Tüm Şehirleri Göster

#### 4.2.4 Geçmiş Ekranı - Değişiklik Yok

**Durum:** `recentChanges.length === 0`

```javascript
<EmptyState
  icon="clock-outline"
  iconColor={colors.info}
  title="Henüz fiyat değişikliği yok"
  description="Son günlerde kayda değer bir fiyat hareketi tespit edilmedi."
  // Aksiyon yok
/>
```

**Copy:**
- **Başlık:** Henüz fiyat değişikliği yok
- **Açıklama:** Son günlerde kayda değer bir fiyat hareketi tespit edilmedi.
- **Aksiyon:** -

#### 4.2.5 Aracım Ekranı - Fiş Geçmişi Boş

**Durum:** `expenseHistory.length === 0`

```javascript
<EmptyState
  icon="receipt-text-outline"
  iconColor={colors.warning}
  title="Henüz fiş kaydı yok"
  description="Yakıt alımlarınızı kaydetmek için yukarıdaki '+ Yakıt Fişi Ekle' butonunu kullanabilirsiniz."
  actionLabel="İlk Fişi Ekle"
  onActionPress={() => setReceiptModalOpen(true)}
/>
```

**Copy:**
- **Başlık:** Henüz fiş kaydı yok
- **Açıklama:** Yakıt alımlarınızı kaydetmek için yukarıdaki '+ Yakıt Fişi Ekle' butonunu kullanabilirsiniz.
- **Aksiyon:** İlk Fişi Ekle

#### 4.2.6 Bildirimler Ekranı - Özel Alarm Yok

**Durum:** `customAlerts.length === 0`

```javascript
<EmptyState
  icon="bell-plus-outline"
  iconColor={colors.accent}
  title="Özel fiyat alarmı yok"
  description="Belirli fiyat eşiklerine ulaşıldığında bildirim almak için alarm oluşturun."
  actionLabel="İlk Alarmı Oluştur"
  onActionPress={() => setNewAlertModalOpen(true)}
/>
```

**Copy:**
- **Başlık:** Özel fiyat alarmı yok
- **Açıklama:** Belirli fiyat eşiklerine ulaşıldığında bildirim almak için alarm oluşturun.
- **Aksiyon:** İlk Alarmı Oluştur

### 4.3 Empty State İllüstrasyon / İkon Tablosu

| Ekran | Durum | İkon | İkon Rengi | Önerilen Büyüklük |
|-------|-------|------|------------|-------------------|
| Ana Sayfa | Favori şehir yok | `heart-outline` | `danger` (#F43F5E) | 48pt |
| İller | Arama sonucu yok | `map-search-outline` | `accent` (#38BDF8) | 48pt |
| İller | Favori listesi boş | `heart-plus-outline` | #FF4D4D | 48pt |
| Geçmiş | Değişiklik yok | `clock-outline` | `info` (#60A5FA) | 48pt |
| Aracım | Fiş geçmişi boş | `receipt-text-outline` | `warning` (#F59E0B) | 48pt |
| Bildirimler | Özel alarm yok | `bell-plus-outline` | `accent` (#38BDF8) | 48pt |

---

## 5. Error & Success States (Hata ve Başarı Durumu)

### 5.1 Toast Notification Sistemi

#### 5.1.1 Toast Tasarımı

**ÖNERİLEN YENİ COMPONENT:** `mobile/src/components/Toast.js`

```javascript
import { useEffect, useRef } from 'react'
import { Animated, Text, View, StyleSheet, AccessibilityInfo, Platform } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors } from '../theme'

const TOAST_DURATION = 4000 // 4 saniye

export function Toast({ visible, variant = 'info', message, onHide }) {
  const translateY = useRef(new Animated.Value(-100)).current

  useEffect(() => {
    if (visible) {
      // Giriş animasyonu
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start()

      // Ekran okuyucuya duyur
      AccessibilityInfo.announceForAccessibility(message)

      // Otomatik kapanma
      const timer = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }).start(() => onHide?.())
      }, TOAST_DURATION)

      return () => clearTimeout(timer)
    }
  }, [visible, message, translateY, onHide])

  if (!visible) return null

  const config = TOAST_VARIANTS[variant]

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          transform: [{ translateY }],
        },
      ]}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.iconBox, { backgroundColor: config.iconBg }]}>
        <MaterialCommunityIcons name={config.icon} size={20} color={config.iconColor} />
      </View>
      <Text style={styles.message} numberOfLines={3}>
        {message}
      </Text>
    </Animated.View>
  )
}

const TOAST_VARIANTS = {
  success: {
    icon: 'check-circle-outline',
    iconColor: '#34D399',
    iconBg: '#064E3B',
    bg: colors.surface,
    border: '#34D399',
  },
  error: {
    icon: 'alert-circle-outline',
    iconColor: colors.danger,
    iconBg: colors.dangerDark,
    bg: colors.surface,
    border: colors.danger,
  },
  warning: {
    icon: 'alert-outline',
    iconColor: colors.warning,
    iconBg: colors.warningDark,
    bg: colors.surface,
    border: colors.warning,
  },
  info: {
    icon: 'information-outline',
    iconColor: colors.info,
    iconBg: '#0C2A4A',
    bg: colors.surface,
    border: colors.info,
  },
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
})
```

#### 5.1.2 Toast Kullanımı

**Global Toast Manager (opsiyonel):**
```javascript
// mobile/src/contexts/ToastContext.js

import { createContext, useContext, useState } from 'react'
import { Toast } from '../components/Toast'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ visible: false, variant: 'info', message: '' })

  const showToast = (variant, message) => {
    setToast({ visible: true, variant, message })
  }

  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast {...toast} onHide={hideToast} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
```

**Ekranlarda kullanım:**
```javascript
import { useToast } from '../contexts/ToastContext'

function AnaSayfa() {
  const { showToast } = useToast()

  async function handleRefresh() {
    try {
      await refresh()
      showToast('success', 'Fiyatlar başarıyla güncellendi!')
    } catch (error) {
      showToast('error', 'Fiyatlar güncellenirken hata oluştu.')
    }
  }
  
  // ...
}
```

### 5.2 Error States (Hata Durumları)

#### 5.2.1 Network Offline (Çevrimdışı)

**Durum:** İnternet bağlantısı yok

```javascript
// Algılama: @react-native-community/netinfo kullan
import NetInfo from '@react-native-community/netinfo'

const [isOffline, setIsOffline] = useState(false)

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    setIsOffline(!state.isConnected)
  })
  return unsubscribe
}, [])

// UI:
{isOffline && (
  <View style={styles.offlineBanner}>
    <MaterialCommunityIcons name="wifi-off" size={16} color={colors.warning} />
    <Text style={styles.offlineBannerText}>
      İnternet bağlantısı yok. Veriler güncel olmayabilir.
    </Text>
  </View>
)}
```

**Stil:**
```javascript
offlineBanner: {
  backgroundColor: colors.warningDark,
  borderBottomWidth: 1,
  borderBottomColor: colors.warning,
  paddingHorizontal: 16,
  paddingVertical: 10,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
}
offlineBannerText: {
  color: colors.warning,
  fontSize: 12,
  fontWeight: '700',
  flex: 1,
}
```

**Copy:** İnternet bağlantısı yok. Veriler güncel olmayabilir.

#### 5.2.2 Server Error (Sunucu Hatası)

**Durum:** API isteği 500+ hata döndü

**Toast kullan:**
```javascript
showToast('error', 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.')
```

**Copy:** Sunucu hatası. Lütfen daha sonra tekrar deneyin.

#### 5.2.3 Location Permission Denied (Konum İzni Reddedildi)

**Not:** Şu anda konum özelliği kullanılmıyor (`nearbyStations.js` pasif) ancak gelecekte aktifleşirse:

**Full Screen Error State:**
```javascript
<EmptyState
  icon="map-marker-off-outline"
  iconColor={colors.danger}
  title="Konum izni verilmedi"
  description="Yakın istasyonları görebilmek için konum izni gereklidir. Ayarlardan izin verebilirsiniz."
  actionLabel="Ayarlara Git"
  onActionPress={() => Linking.openSettings()}
/>
```

**Copy:**
- **Başlık:** Konum izni verilmedi
- **Açıklama:** Yakın istasyonları görebilmek için konum izni gereklidir. Ayarlardan izin verebilirsiniz.
- **Aksiyon:** Ayarlara Git

#### 5.2.4 No Data for Selected Province (Seçili İl için Veri Yok)

**Durum:** Backend'den belirli bir il için fiyat verisi gelmedi

**Empty State kullan:**
```javascript
<EmptyState
  icon="database-off-outline"
  iconColor={colors.warning}
  title="Bu il için veri bulunamadı"
  description="İl fiyat verileri henüz güncellenmemiş olabilir. Daha sonra tekrar deneyin."
  actionLabel="Başka İl Seç"
  onActionPress={() => setCityPickerOpen(true)}
/>
```

**Copy:**
- **Başlık:** Bu il için veri bulunamadı
- **Açıklama:** İl fiyat verileri henüz güncellenmemiş olabilir. Daha sonra tekrar deneyin.
- **Aksiyon:** Başka İl Seç

### 5.3 Success States (Başarı Durumu)

#### 5.3.1 Fiyatlar Güncellendi

**Durum:** Manuel refresh tamamlandı

**Toast:**
```javascript
showToast('success', 'Fiyatlar başarıyla güncellendi!')
```

**Copy:** Fiyatlar başarıyla güncellendi!

#### 5.3.2 Fiş Kaydedildi

**Durum:** Araç fişi başarıyla eklendi

**Toast:**
```javascript
showToast('success', 'Yakıt fişi başarıyla kaydedildi.')
```

**Copy:** Yakıt fişi başarıyla kaydedildi.

#### 5.3.3 Alarm Oluşturuldu

**Durum:** Özel fiyat alarmı başarıyla eklendi

**Toast:**
```javascript
showToast('success', 'Fiyat alarmı başarıyla oluşturuldu.')
```

**Copy:** Fiyat alarmı başarıyla oluşturuldu.

#### 5.3.4 Hesaplama Tamamlandı

**Durum:** Araç maliyeti hesaplandı ve kaydedildi

**Modal zaten var (AnaSayfa.js:504-532), Toast ekleme:**
```javascript
// Modal kapandığında
onRequestClose={() => {
  setResultOpen(false)
  showToast('success', 'Maliyet kaydedildi.')
}}
```

**Copy:** Maliyet kaydedildi.

---

## 6. Ekran-Durum Matrisi

| Ekran | Loading State | Empty State | Error State | Success State |
|-------|--------------|-------------|-------------|---------------|
| **Ana Sayfa** | Skeleton (3'lü kart + grafik) | Favori şehir yok | Ağ hatası (banner) | Fiyatlar güncellendi (toast) |
| **İller** | Skeleton (şehir listesi) | Arama sonucu yok / Favori boş | Ağ hatası (banner) | - |
| **Geçmiş** | Skeleton (bar grafik) | Değişiklik yok | Ağ hatası (banner) | - |
| **Aracım** | Skeleton (grafik + fiş listesi) | Fiş geçmişi boş | Ağ hatası (banner) | Fiş kaydedildi / Maliyet kaydedildi (toast) |
| **Bildirimler** | Spinner (izin kontrol) | Özel alarm yok | Token hatası (kart içinde göster) | Alarm oluşturuldu (toast) |

---

## 7. Erişilebilirlik Duyuruları

### 7.1 AccessibilityInfo.announceForAccessibility

**Ne zaman kullanılır:**
- Toast gösterildiğinde
- Veri yükleme tamamlandığında
- Hata oluştuğunda

**Örnek:**
```javascript
import { AccessibilityInfo } from 'react-native'

// Success
AccessibilityInfo.announceForAccessibility('Fiyatlar başarıyla güncellendi')

// Error
AccessibilityInfo.announceForAccessibility('Hata: Sunucuya bağlanılamadı')

// Loading completed
AccessibilityInfo.announceForAccessibility('Veri yükleme tamamlandı')
```

### 7.2 accessibilityLiveRegion

**Toast component'inde zaten kullanılıyor:**
```javascript
<Animated.View
  accessible={true}
  accessibilityRole="alert"
  accessibilityLiveRegion="polite"  // Ekran okuyucu otomatik okur
>
```

**`polite` vs `assertive`:**
- **polite:** Normal öncelik, mevcut okuma bitince duyurur (önerilen)
- **assertive:** Yüksek öncelik, hemen duyurur (kritik hatalar için)

---

## 8. Reduce Motion Desteği

### 8.1 Skeleton Animasyonu

```javascript
import { AccessibilityInfo } from 'react-native'

const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false)

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled)
}, [])

// Skeleton component'inde:
{reduceMotionEnabled ? (
  <View style={[styles.skeleton, { opacity: 0.5 }]} />
) : (
  <Animated.View style={[styles.skeleton, { opacity }]} />
)}
```

### 8.2 Toast Animasyonu

```javascript
// Toast.js içinde
const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false)

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled)
}, [])

// Giriş animasyonu:
if (reduceMotionEnabled) {
  // Anlık göster, animasyon yok
  translateY.setValue(0)
} else {
  // Normal spring animasyon
  Animated.spring(translateY, { ... }).start()
}
```

---

## 9. Implementation Checklist

### Aşama 1: Component'ler (Öncelik: P0)

- [ ] **`mobile/src/components/SkeletonLoader.js`** oluştur
  - [ ] Pulse animasyonu ekle
  - [ ] Reduce motion desteği ekle
  - [ ] Props: width, height, borderRadius, style

- [ ] **`mobile/src/components/EmptyState.js`** oluştur
  - [ ] Icon, title, description, action props
  - [ ] Erişilebilirlik label'ları ekle

- [ ] **`mobile/src/components/Toast.js`** oluştur
  - [ ] 4 varyant: success, error, warning, info
  - [ ] Otomatik kapanma (4 saniye)
  - [ ] Ekran okuyucu duyurusu
  - [ ] Reduce motion desteği

- [ ] **`mobile/src/contexts/ToastContext.js`** oluştur (opsiyonel ama önerilen)
  - [ ] Global toast yönetimi
  - [ ] `useToast()` hook

### Aşama 2: Ana Sayfa (Öncelik: P1)

- [ ] **Loading State:**
  - [ ] 3'lü yakıt kartı skeleton'u ekle
  - [ ] 7 günlük grafik skeleton'u ekle
  - [ ] Favori şehir bölümü skeleton'u ekle

- [ ] **Empty State:**
  - [ ] Favori şehir yok state'i ekle

- [ ] **Success Toast:**
  - [ ] Manuel refresh tamamlandığında toast göster

### Aşama 3: İller Ekranı (Öncelik: P1)

- [ ] **Loading State:**
  - [ ] Şehir listesi skeleton'u ekle (5 adet)

- [ ] **Empty States:**
  - [ ] Arama sonucu yok
  - [ ] Favori listesi boş

### Aşama 4: Geçmiş Ekranı (Öncelik: P1)

- [ ] **Loading State:**
  - [ ] Bar grafik skeleton'u ekle

- [ ] **Empty State:**
  - [ ] Değişiklik yok state'i ekle

### Aşama 5: Aracım Ekranı (Öncelik: P1)

- [ ] **Loading State:**
  - [ ] Aylık gider grafiği skeleton'u ekle
  - [ ] Fiş listesi skeleton'u ekle

- [ ] **Empty State:**
  - [ ] Fiş geçmişi boş state'i ekle

- [ ] **Success Toasts:**
  - [ ] Fiş kaydedildi toast'u
  - [ ] Maliyet kaydedildi toast'u

### Aşama 6: Bildirimler Ekranı (Öncelik: P2)

- [ ] **Loading State:**
  - [ ] İzin kontrol ederken spinner göster

- [ ] **Empty State:**
  - [ ] Özel alarm yok state'i ekle

- [ ] **Success Toast:**
  - [ ] Alarm oluşturuldu toast'u

### Aşama 7: Error Handling (Öncelik: P1)

- [ ] **Network Offline Banner:**
  - [ ] NetInfo entegrasyonu
  - [ ] Üstte warning banner göster

- [ ] **Error Toasts:**
  - [ ] Sunucu hatası
  - [ ] Veri yok hatası

### Aşama 8: Test (Öncelik: P2)

- [ ] **Visual Testing:**
  - [ ] Her ekranda skeleton'ları görsel olarak doğrula
  - [ ] Empty state'lerin doğru göründüğünü kontrol et
  - [ ] Toast'ların doğru konumda ve stillerde göründüğünü test et

- [ ] **Accessibility Testing:**
  - [ ] VoiceOver ile toast duyurularını test et
  - [ ] Empty state label'larını test et
  - [ ] Reduce motion ile skeleton/toast animasyonlarını test et

- [ ] **Timing Testing:**
  - [ ] Skeleton'ların 200ms eşiğinden sonra göründüğünü doğrula
  - [ ] Toast'ların 4 saniye sonra kaybolduğunu test et

---

## 10. Sonuç

Bu spesifikasyon, YakitRadar uygulamasının tüm state'lerini (loading, empty, error, success) tutarlı ve erişilebilir bir şekilde tasarlamaktadır. Implementation tamamlandığında:

✅ **Kullanıcı deneyimi:** Kullanıcılar her durumda ne olduğunu anlayabilir  
✅ **Erişilebilirlik:** Ekran okuyucu kullanıcıları durum değişikliklerinden haberdar olur  
✅ **Performans:** Hafif animasyonlar, reduce-motion desteği  
✅ **Tutarlılık:** Tüm ekranlarda aynı görsel dil

**Tahmini Geliştirme Süresi:**
- Component'ler (SkeletonLoader, EmptyState, Toast): ~2 gün
- Ekranlara entegrasyon: ~3-4 gün
- Test ve polish: ~1 gün
- **Toplam:** ~6-7 iş günü (1 frontend developer)

---

**Rapor Tarihi:** 9 Ekim 2026  
**Son Güncelleme:** 9 Ekim 2026  
**Versiyon:** 1.0
