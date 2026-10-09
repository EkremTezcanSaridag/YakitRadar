import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import CityPickerModal from '../components/CityPickerModal'
import ScreenHeader from '../components/ScreenHeader'
import { colors, radii, spacing, typography } from '../theme'
import { useFuelData } from '../hooks/useFuelData'
import { computeNationalAverages, getRealPriceRows } from '../services/fuelData'
import {
  defaultFavoriteCities,
  loadFavoriteCities,
  loadLocationCityMeta,
  setPrimaryCityManual,
} from '../services/favoriteCities'

const FUEL_OPTIONS = [
  { key: 'benzin95', label: 'Benzin', icon: 'car-sport-outline' },
  { key: 'motorin', label: 'Motorin', icon: 'bus-outline' },
  { key: 'lpg', label: 'LPG', icon: 'flame-outline' },
]

function formatPrice(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '--'
}

export default function AnaSayfa() {
  const { data, refresh, refreshing } = useFuelData()
  const [favCities, setFavCities] = useState(defaultFavoriteCities)
  const [fuelKey, setFuelKey] = useState('benzin95')
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [locationMeta, setLocationMeta] = useState(null)

  const reloadFavorites = useCallback(() => {
    loadFavoriteCities().then(setFavCities)
    loadLocationCityMeta().then(setLocationMeta)
  }, [])

  useEffect(() => {
    reloadFavorites()
  }, [reloadFavorites])

  useFocusEffect(
    useCallback(() => {
      reloadFavorites()
    }, [reloadFavorites]),
  )

  async function handleSelectCity(cityName) {
    const next = await setPrimaryCityManual(cityName)
    setFavCities(next)
    setLocationMeta(null)
  }

  const realPrices = useMemo(() => getRealPriceRows(data.prices), [data.prices])
  const hasRealData = data.hasRealPrices && realPrices.length > 0
  const heroCityName = favCities[0] ?? 'İstanbul'

  const heroCity = useMemo(() => {
    if (!hasRealData) return null
    return (
      realPrices.find((row) => row.city === heroCityName)
      ?? realPrices.find((row) => row.city === 'İstanbul')
      ?? realPrices[0]
    )
  }, [hasRealData, realPrices, heroCityName])

  const heroPrice = heroCity?.[fuelKey] ?? 0

  const nationalAverage = useMemo(() => {
    const averages = computeNationalAverages(realPrices)
    return averages[fuelKey] ?? 0
  }, [realPrices, fuelKey])

  const favoriteRows = useMemo(() => {
    return favCities.map((cityName) => {
      const row = realPrices.find((item) => item.city === cityName)
      return {
        city: cityName,
        price: row?.[fuelKey] ?? 0,
        isHero: cityName === heroCity?.city,
      }
    })
  }, [realPrices, favCities, fuelKey, heroCity?.city])

  const fuelLabel = FUEL_OPTIONS.find((fuel) => fuel.key === fuelKey)?.label ?? 'Yakıt'

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            onRefresh={refresh}
            progressBackgroundColor={colors.surface}
            refreshing={refreshing}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader showRefresh title="Ana Sayfa" />

        {!hasRealData ? (
          <View style={styles.emptyDataBlock}>
            <Ionicons color={colors.mutedSoft} name="cloud-offline-outline" size={32} />
            <Text allowFontScaling style={styles.emptyDataTitle}>Veri yok</Text>
            <Text allowFontScaling style={styles.emptyDataText}>
              Güncel fiyat verisi alınamadı. Aşağıdan yenilemeyi deneyebilirsiniz.
            </Text>
          </View>
        ) : (
          <>
        <View style={styles.heroBlock}>
          <Text allowFontScaling style={styles.heroEyebrow}>Senin şehrin</Text>
          <Pressable
            accessibilityHint="Şehir listesini aç"
            accessibilityRole="button"
            onPress={() => setCityPickerOpen(true)}
            style={({ pressed }) => [styles.heroCityButton, pressed && styles.pressed]}
          >
            <Text allowFontScaling style={styles.heroCity}>{heroCity?.city ?? 'İstanbul'}</Text>
            <Ionicons color={colors.muted} name="chevron-down" size={22} style={styles.heroCityChevron} />
          </Pressable>
          <View style={styles.heroPriceRow}>
            <Text allowFontScaling style={styles.heroPrice}>{formatPrice(heroPrice)}</Text>
            <Text allowFontScaling style={styles.heroUnit}>₺/L</Text>
          </View>
          <Text allowFontScaling style={styles.heroFuelHint}>{fuelLabel}</Text>
          {locationMeta?.source === 'location' && locationMeta.city === heroCity?.city ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setCityPickerOpen(true)}
              style={({ pressed }) => [styles.locationNoteRow, pressed && styles.pressed]}
            >
              <Ionicons color={colors.mutedSoft} name="navigate-outline" size={14} />
              <Text allowFontScaling style={styles.locationNoteText}>
                Konumuna göre {locationMeta.city} seçildi ·{' '}
                <Text style={styles.locationNoteAction}>Değiştir</Text>
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.fuelSelector}>
          {FUEL_OPTIONS.map((fuel) => {
            const active = fuel.key === fuelKey
            return (
              <Pressable
                key={fuel.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFuelKey(fuel.key)}
                style={({ pressed }) => [
                  styles.fuelChip,
                  active && styles.fuelChipActive,
                  active && pressed && styles.fuelChipPressed,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={fuel.icon}
                  size={18}
                  color={active ? colors.onAccent : colors.muted}
                />
                <Text allowFontScaling style={[styles.fuelChipText, active && styles.fuelChipTextActive]}>
                  {fuel.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Karşılaştırma</Text>
          <View style={styles.listBlock}>
            <View style={styles.listRow}>
              <Text style={styles.listTitle}>81 il ortalaması</Text>
              <Text style={styles.listPrice}>{formatPrice(nationalAverage)} ₺/L</Text>
            </View>
            {favoriteRows.map((row) => (
              <View key={row.city} style={[styles.listRow, styles.listRowBorder]}>
                <View style={styles.listTitleWrap}>
                  {row.isHero ? (
                    <Ionicons name="location" size={14} color={colors.accent} style={styles.listIcon} />
                  ) : null}
                  <Text style={styles.listTitle}>{row.city}</Text>
                </View>
                <Text style={styles.listPrice}>{formatPrice(row.price)} ₺/L</Text>
              </View>
            ))}
          </View>
        </View>

        {data.marketSignal?.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Piyasa notu</Text>
            <View style={styles.noteBlock}>
              <Ionicons name="pulse-outline" size={20} color={colors.muted} />
              <Text style={styles.noteText}>{data.marketSignal.summary}</Text>
            </View>
          </View>
        ) : null}
          </>
        )}
      </ScrollView>

      <CityPickerModal
        onClose={() => setCityPickerOpen(false)}
        onSelect={handleSelectCity}
        prices={data.prices}
        selectedCity={heroCity?.city}
        visible={cityPickerOpen}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: 96,
  },
  emptyDataBlock: {
    alignItems: 'flex-start',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyDataTitle: {
    color: colors.muted,
    fontSize: typography.heading,
    fontWeight: '600',
  },
  emptyDataText: {
    color: colors.mutedSoft,
    fontSize: typography.body,
    lineHeight: 22,
  },
  heroBlock: {
    marginBottom: spacing.xl,
    paddingVertical: spacing.xl,
  },
  heroEyebrow: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroCityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  heroCity: {
    color: colors.text,
    fontSize: typography.display,
    fontWeight: '700',
  },
  heroCityChevron: {
    marginTop: spacing.sm,
  },
  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  heroPrice: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    color: colors.muted,
    fontSize: typography.heading,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  heroFuelHint: {
    color: colors.mutedSoft,
    fontSize: typography.body,
    marginTop: spacing.xs,
  },
  locationNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  locationNoteText: {
    color: colors.mutedSoft,
    fontSize: typography.caption,
    flexShrink: 1,
  },
  locationNoteAction: {
    color: colors.muted,
    fontWeight: '600',
  },
  fuelSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.section,
  },
  fuelChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fuelChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  fuelChipPressed: {
    backgroundColor: colors.accentPressed,
    borderColor: colors.accentPressed,
  },
  fuelChipText: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  fuelChipTextActive: {
    color: colors.onAccent,
  },
  section: {
    marginBottom: spacing.section,
  },
  sectionLabel: {
    color: colors.mutedSoft,
    fontSize: typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  listBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  listRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  listTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listIcon: {
    marginRight: spacing.xs,
  },
  listTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
  },
  listPrice: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  noteBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  noteText: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.88,
  },
})
