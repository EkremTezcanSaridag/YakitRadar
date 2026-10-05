import { useEffect, useMemo, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native'
import { colors, shadows } from '../theme'
import { useFuelData } from '../hooks/useFuelData'
import { fuelTabs } from '../services/fuelData'
import { defaultFavoriteCities, loadFavoriteCities, toggleFavoriteCity } from '../services/favoriteCities'

function formatCurrency(value) {
  return `${value.toFixed(2)} ₺`
}

function formatChange(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} ₺`
}

function formatStationCount(value) {
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} istasyon`
}

function normalizeSearch(value) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıIİi]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
}

export default function Iller() {
  const { data, refresh, refreshing } = useFuelData()
  const [selectedFuel, setSelectedFuel] = useState(fuelTabs[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [favoriteCities, setFavoriteCities] = useState(defaultFavoriteCities)
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)
  const selectedFuelKey = selectedFuel.key
  const selectedFuelTitle = selectedFuel.title

  useEffect(() => {
    loadFavoriteCities().then(setFavoriteCities)
  }, [])

  async function handleToggleFavorite(cityName) {
    const updated = await toggleFavoriteCity(cityName)
    setFavoriteCities(updated)
  }

  const cities = useMemo(
    () => {
      const normalizedQuery = normalizeSearch(searchQuery.trim())

      return [...data.prices]
        .filter((city) => {
          if (showOnlyFavorites && !favoriteCities.includes(city.city)) return false
          if (normalizedQuery && !normalizeSearch(city.city).includes(normalizedQuery)) return false
          return true
        })
        .sort((first, second) => first[selectedFuelKey] - second[selectedFuelKey])
        .map((city) => ({
          name: city.city,
          price: formatCurrency(city[selectedFuelKey]),
          change: formatChange(city.change),
          stations: formatStationCount(city.stations),
          isFavorite: favoriteCities.includes(city.city),
        }))
    },
    [data.prices, favoriteCities, searchQuery, selectedFuelKey, showOnlyFavorites],
  )

  const bestCity = cities[0]
  const hasSearchQuery = searchQuery.trim().length > 0

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
        <View style={styles.header}>
          <View style={styles.headerMark}>
            <MaterialCommunityIcons name="gas-station" size={18} color={colors.accent} />
          </View>
          <View style={styles.brandRow}>
            <Text style={styles.brandMain}>YAKIT </Text>
            <Text style={styles.brandAccent}>RADAR</Text>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.accent} />
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            placeholder="İl ara..."
            placeholderTextColor={colors.mutedSoft}
            returnKeyType="search"
            selectionColor={colors.accent}
            style={styles.searchInput}
            value={searchQuery}
          />
          {hasSearchQuery && (
            <Pressable
              accessibilityLabel="Aramayı temizle"
              onPress={() => setSearchQuery('')}
              style={({ pressed }) => [styles.clearSearchButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="close" size={15} color={colors.mutedSoft} />
            </Pressable>
          )}
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Şehir Bazlı Fiyatlar</Text>
            <Text style={styles.subtitle}>{selectedFuelTitle} için günlük ortalama fiyatlar.</Text>
          </View>
          <View style={styles.titleActions}>
            <Pressable
              accessibilityLabel="Fiyatları yenile"
              onPress={refresh}
              style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={17}
                color={refreshing ? colors.mutedSoft : colors.accent}
              />
            </Pressable>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{cities.length} İl</Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentRow}>
          <Pressable
            onPress={() => setShowOnlyFavorites((prev) => !prev)}
            style={({ pressed }) => [styles.segment, showOnlyFavorites && styles.favoriteSegmentActive, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons
              name={showOnlyFavorites ? 'heart' : 'heart-outline'}
              size={14}
              color={showOnlyFavorites ? '#FF4D4D' : colors.mutedSoft}
            />
            <Text style={[styles.segmentText, showOnlyFavorites && { color: '#FF4D4D' }]}>Favoriler ({favoriteCities.length})</Text>
          </Pressable>

          {fuelTabs.map((item) => {
            const selected = item.key === selectedFuel.key

            return (
              <Pressable
                key={item.key}
                onPress={() => setSelectedFuel(item)}
                style={({ pressed }) => [styles.segment, selected && styles.segmentActive, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={14}
                  color={selected ? colors.accent : colors.mutedSoft}
                />
                <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{item.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={styles.insightCard}>
          <View style={styles.insightIcon}>
            <MaterialCommunityIcons name="trending-down" size={20} color={colors.accent} />
          </View>
          <View style={styles.insightCopy}>
            <Text style={styles.insightTitle}>
              {bestCity ? `En uygun şehir ${bestCity.name}` : 'Sonuç bulunamadı'}
            </Text>
            <Text style={styles.insightDesc}>
              {bestCity
                ? `Bugünkü listede en düşük ${selectedFuelTitle} fiyatı.`
                : 'Aramayı temizleyip tekrar deneyebilirsiniz.'}
            </Text>
          </View>
          <Text style={styles.insightPrice}>{bestCity?.price ?? '--'}</Text>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{showOnlyFavorites ? 'Favori Şehirler' : 'Şehir Listesi'}</Text>
          <Text style={styles.listMeta}>{selectedFuelTitle}</Text>
        </View>

        {cities.length === 0 && (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="map-search-outline" size={28} color={colors.accent} />
            <Text style={styles.emptyTitle}>{showOnlyFavorites ? 'Favori iliniz yok' : 'İl bulunamadı'}</Text>
            <Text style={styles.emptyText}>{showOnlyFavorites ? 'Kalp simgesine dokunarak il ekleyin.' : 'Arama metnini kısaltarak tekrar deneyin.'}</Text>
          </View>
        )}

        {cities.map((city, index) => {
          const trendUp = city.change.startsWith('+')

          return (
            <View key={city.name} style={styles.cityCard}>
              <View style={styles.rankBox}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>

              <View style={styles.cityInfo}>
                <View style={styles.cityNameRow}>
                  <Text style={styles.cityName}>{city.name}</Text>
                  <Pressable onPress={() => handleToggleFavorite(city.name)} style={styles.heartButton}>
                    <MaterialCommunityIcons
                      name={city.isFavorite ? 'heart' : 'heart-outline'}
                      size={18}
                      color={city.isFavorite ? '#FF4D4D' : colors.muted}
                    />
                  </Pressable>
                </View>
                <View style={styles.cityChangeWrap}>
                  <MaterialCommunityIcons
                    name={trendUp ? 'arrow-up-bold' : 'arrow-down-bold'}
                    size={12}
                    color={trendUp ? colors.warning : colors.accent}
                  />
                  <Text style={[styles.cityChange, trendUp ? styles.cityChangeUp : styles.cityChangeDown]}>
                    {city.change} ort. fiyattan
                  </Text>
                </View>
              </View>

              <View style={styles.priceWrap}>
                <Text style={styles.price}>{city.price}</Text>
                <Text style={styles.priceUnit}>/ litre</Text>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -16,
    marginTop: -8,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerMark: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandMain: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandAccent: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.mutedSoft,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 10,
    minHeight: 44,
    paddingVertical: 0,
  },
  clearSearchButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    marginLeft: 8,
    width: 28,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  titleActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  countBadge: {
    backgroundColor: colors.accentDark,
    borderColor: colors.accent,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  countBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    marginRight: 8,
    width: 34,
  },
  pressed: {
    opacity: 0.72,
  },
  segmentRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentActive: {
    backgroundColor: colors.accentDark,
    borderColor: colors.accent,
  },
  favoriteSegmentActive: {
    backgroundColor: '#331111',
    borderColor: '#FF4D4D',
  },
  cityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
    gap: 6,
  },
  heartButton: {
    padding: 2,
  },
  segmentText: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 5,
  },
  segmentTextActive: {
    color: colors.accent,
  },
  insightCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 16,
    padding: 14,
    ...shadows.soft,
  },
  insightIcon: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  insightCopy: {
    flex: 1,
    paddingRight: 8,
  },
  insightTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  insightDesc: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  insightPrice: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '900',
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  listTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  listMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  cityCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...shadows.soft,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
    ...shadows.soft,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyText: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },
  rankBox: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    marginRight: 12,
    width: 36,
  },
  rankText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  cityInfo: {
    flex: 1,
    paddingRight: 10,
  },
  cityName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  cityMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  cityMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  cityChangeWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  cityChange: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },
  cityChangeUp: {
    color: colors.warning,
  },
  cityChangeDown: {
    color: colors.accent,
  },
  priceWrap: {
    alignItems: 'flex-end',
  },
  price: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  priceUnit: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  viewModeToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: 12,
  },
  viewModeBtn: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewModeBtnActive: {
    backgroundColor: colors.accent,
  },
  viewModeBtnText: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  viewModeBtnTextActive: {
    color: colors.bg,
    fontWeight: '900',
  },
  singleGpsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    ...shadows.soft,
  },
  singleGpsCardActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  singleGpsIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  singleGpsIconBoxActive: {
    backgroundColor: colors.surfaceAlt,
  },
  singleGpsCopy: {
    flex: 1,
  },
  singleGpsTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  singleGpsTextActive: {
    color: colors.bg,
  },
  singleGpsSubtitle: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  singleGpsSubActive: {
    color: colors.bg,
    opacity: 0.9,
  },
  stationSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sortTogglePill: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  sortSubBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sortSubBtnActive: {
    backgroundColor: colors.surfaceAlt,
  },
  sortSubText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  sortSubTextActive: {
    color: colors.accent,
    fontWeight: '900',
  },
  stationCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    ...shadows.card,
  },
  stationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stationBrandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stationBrandText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  distanceChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  stationName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 2,
  },
  stationAddress: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 12,
  },
  stationPricesRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: 8,
    padding: 8,
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  stationPriceBox: {
    alignItems: 'center',
  },
  stFuelLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  stFuelVal: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  stationFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  servicesChipRow: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  srvBadge: {
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  srvBadgeText: {
    color: colors.mutedSoft,
    fontSize: 9,
    fontWeight: '700',
  },
  mapDirectionsBtn: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mapDirectionsBtnText: {
    color: colors.bg,
    fontSize: 11,
    fontWeight: '900',
  },
})
