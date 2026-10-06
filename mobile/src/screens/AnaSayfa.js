import { Fragment, useEffect, useMemo, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, RefreshControl, ScrollView, View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { colors, shadows } from '../theme'
import { useFuelData } from '../hooks/useFuelData'
import { buildDetailedFuelPredictions } from '../services/fuelData'
import { defaultFavoriteCities, loadFavoriteCities } from '../services/favoriteCities'
import { defaultAlerts, evaluateCustomAlerts, loadCustomAlerts } from '../services/customAlerts'

const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const fuelSignalIcons = {
  Benzin: 'gas-station',
  Motorin: 'truck-outline',
  LPG: 'fire',
}
const signalToneIcons = {
  decrease: 'arrow-down-bold',
  increase: 'arrow-up-bold',
  neutral: 'minus',
}

const chartHeight = 118

function buildPoints(values, chartWidth, domain) {
  const horizontalPadding = 12
  const verticalPadding = 12
  const usableWidth = chartWidth - horizontalPadding * 2
  const usableHeight = chartHeight - verticalPadding * 2
  const step = usableWidth / Math.max(values.length - 1, 1)
  const min = domain?.min ?? 20
  const max = domain?.max ?? 85

  return values.map((value, index) => ({
    x: horizontalPadding + index * step,
    y: verticalPadding + ((max - value) / Math.max(max - min, 1)) * usableHeight,
    value,
  }))
}

function buildSegments(points, strokeWidth) {
  return points.slice(0, -1).map((point, index) => {
    const next = points[index + 1]
    const dx = next.x - point.x
    const dy = next.y - point.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)

    return {
      angle,
      left: point.x + dx / 2 - length / 2,
      top: point.y + dy / 2 - strokeWidth / 2,
      width: length,
    }
  })
}

function guideLeft(index, count, chartWidth, padding) {
  if (count <= 1) {
    return chartWidth / 2
  }

  return padding + (index * (chartWidth - padding * 2)) / (count - 1)
}

function formatLegendValue(values) {
  const lastValue = values[values.length - 1]

  return Number.isFinite(lastValue) ? `${lastValue.toFixed(2)} TL` : '--'
}

function getUpdateLabel(data, refreshing) {
  if (refreshing) {
    return 'Yenileniyor...'
  }

  if (data.refreshRequest?.status === 'queued') {
    return 'Backend guncelleme siraya alindi'
  }

  if (data.refreshRequest?.status === 'skipped' && data.refreshRequest?.reason === 'cooldown') {
    return 'Guncelleme zaten tetiklendi'
  }

  if (data.refreshRequest?.status === 'error') {
    return 'Canli guncelleme tetiklenemedi'
  }

  return `Son Güncelleme: ${data.lastUpdatedLabel}`
}

export default function AnaSayfa() {
  const { width } = useWindowDimensions()
  const { data, refresh, refreshing } = useFuelData()
  const [favCities, setFavCities] = useState(defaultFavoriteCities)
  const [userAlerts, setUserAlerts] = useState(defaultAlerts)
  const fuels = data.homeFuels
  const marketSignal = data.marketSignal
  const trendSeries = data.homeTrendSeries
  const chartWidth = Math.max(210, Math.min(width - 92, 330))

  const fuelPredictionsList = useMemo(() => {
    return buildDetailedFuelPredictions(
      marketSignal?.direction ?? 'neutral',
      marketSignal?.score ?? 0,
      marketSignal?.confidence ?? 'high',
      data.prices,
      marketSignal,
    )
  }, [data.prices, marketSignal])

  useEffect(() => {
    loadFavoriteCities().then(setFavCities)
    loadCustomAlerts().then(setUserAlerts)
  }, [])

  const triggeredAlerts = useMemo(() => {
    return evaluateCustomAlerts(userAlerts, data.prices, marketSignal)
  }, [data.prices, marketSignal, userAlerts])

  const favoriteCityPrices = useMemo(() => {
    return favCities.map((cityName) => {
      const cityData = data.prices.find((p) => p.city === cityName)
      return {
        city: cityName,
        benzin: cityData?.benzin95 ?? 0,
        motorin: cityData?.motorin ?? 0,
        lpg: cityData?.lpg ?? 0,
      }
    })
  }, [data.prices, favCities])

  const [selectedChartFuelKey, setSelectedChartFuelKey] = useState('Benzin')

  const currentChartSeries = useMemo(() => {
    return trendSeries.find((s) => s.key === selectedChartFuelKey) ?? trendSeries[0] ?? { key: 'Benzin', color: colors.accent, values: [71.31, 71.31, 71.31, 71.31, 71.31, 71.31, 71.31] }
  }, [selectedChartFuelKey, trendSeries])

  const chartMetrics = useMemo(() => {
    const vals = currentChartSeries.values ?? []
    if (vals.length === 0) return { min: 0, max: 0, diff: 0, diffPct: 0, items: [] }

    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = Math.max(max - min, 0.4)
    const first = vals[0]
    const last = vals[vals.length - 1]
    const diff = last - first
    const diffPct = first > 0 ? (diff / first) * 100 : 0

    const items = vals.map((v, i) => {
      const isFlat = max === min
      const barHeight = isFlat ? 48 : Math.round(22 + ((v - min) / range) * 52)
      return {
        day: days[i] ?? `G${i + 1}`,
        value: v,
        barHeight,
        isToday: i === vals.length - 1,
        isMin: v === min,
        isMax: v === max,
      }
    })

    return { min, max, diff, diffPct, items, last }
  }, [currentChartSeries])

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
        {/* MODERN GLASS HERO HEADER */}
        <View style={styles.heroHeader}>
          <View style={styles.heroHeaderLeft}>
            <View style={styles.heroPulseBox}>
              <MaterialCommunityIcons name="gas-station" size={20} color={colors.accent} />
            </View>
            <View style={styles.heroBrandTextCol}>
              <View style={styles.heroBrandTitleRow}>
                <Text style={styles.heroBrandMain}>YAKIT </Text>
                <Text style={styles.heroBrandAccent}>RADAR</Text>
              </View>
              <Text style={styles.heroBrandSubtitle}>Akaryakıt Takip Sistemi</Text>
            </View>
          </View>

          <View style={styles.heroHeaderRight}>
            <Pressable
              accessibilityLabel="Fiyatları yenile"
              onPress={refresh}
              style={({ pressed }) => [styles.heroRefreshBtn, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={18}
                color={refreshing ? colors.mutedSoft : colors.accent}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroMetaBar}>
          <Text style={styles.heroDateText}>{data.currentDateLabel}</Text>
          <View style={styles.heroUpdatePill}>
            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.accent} />
            <Text style={styles.heroUpdateText}>{getUpdateLabel(data, refreshing)}</Text>
          </View>
        </View>

        {triggeredAlerts.length > 0 ? (
          <View style={styles.triggeredBanner}>
            <View style={styles.triggeredBannerIcon}>
              <MaterialCommunityIcons name="bell-ring-outline" size={18} color="#FBBF24" />
            </View>
            <View style={styles.triggeredBannerCopy}>
              <Text style={styles.triggeredBannerTitle}>Piyasa Zam/İndirim Sinyali</Text>
              <Text style={styles.triggeredBannerText}>Akaryakıt haberlerinde hareketlilik var. Aşağıdaki kartlardan tahmin detaylarını görün.</Text>
            </View>
          </View>
        ) : null}

        {/* 3'LÜ YAKIT FİYATLARI - FERAH VE ŞIK KART DÜZENİ */}
        <View style={styles.fuelHeroSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Akaryakıt Fiyatları</Text>
            <Text style={styles.sectionHeaderSub}>81 İl Ortalaması</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fuelCarouselScroll}>
            {fuels.map((fuel) => {
              const isUp = fuel.rawChange > 0
              const isDown = fuel.rawChange < 0
              return (
                <View
                  key={fuel.name}
                  style={[
                    styles.heroFuelTile,
                    {
                      backgroundColor: fuel.cardBg,
                      borderColor: fuel.cardBorder,
                    },
                  ]}
                >
                  {/* ÜST BİLGİ ŞERİDİ (Yakıt Rozeti + Mini Yüzdelik Değişim Rozeti) */}
                  <View style={styles.heroFuelTop}>
                    <View style={styles.heroFuelBadge}>
                      <MaterialCommunityIcons name={fuel.icon} size={15} color={fuel.accentColor} />
                      <Text style={[styles.heroFuelBadgeText, { color: fuel.accentColor }]}>{fuel.name}</Text>
                    </View>
                    <View
                      style={[
                        styles.heroChangeBadge,
                        isUp ? styles.heroChangeBadgeUp : isDown ? styles.heroChangeBadgeDown : styles.heroChangeBadgeFlat,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isUp ? 'arrow-up-bold' : isDown ? 'arrow-down-bold' : 'minus'}
                        size={10}
                        color={isUp ? colors.danger : isDown ? '#34D399' : colors.mutedSoft}
                      />
                      <Text
                        style={[
                          styles.heroChangeBadgeText,
                          { color: isUp ? colors.danger : isDown ? '#34D399' : colors.mutedSoft },
                        ]}
                      >
                        {fuel.changePct}
                      </Text>
                    </View>
                  </View>

                  {/* BÜYÜK VE NET FİYAT */}
                  <View style={styles.heroFuelBody}>
                    <Text style={styles.heroFuelPrice}>{fuel.price}</Text>
                  </View>

                  {/* ALT BİLGİ ŞERİDİ (Son Güncelleme Tarihi ve Değişim Tutarı) */}
                  <View style={styles.heroFuelFooter}>
                    <Text style={styles.heroFuelDateText}>Son veri · {fuel.dateLabel}</Text>
                    <Text
                      style={[
                        styles.heroFuelDiffSub,
                        { color: isUp ? colors.danger : isDown ? '#34D399' : colors.mutedSoft },
                      ]}
                    >
                      {fuel.change}
                    </Text>
                  </View>
                </View>
              )
            })}
          </ScrollView>
        </View>

        {/* AKARYAKIT TAHMİN KARTLARI - TEMİZLENMİŞ VE FERAH */}
        <View style={styles.predictionDashboard}>
          <View style={styles.predHeader}>
            <View style={styles.predHeaderLeft}>
              <View style={[styles.predRadarIconBox, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="trending-up" size={18} color={colors.accent} />
              </View>
              <View style={styles.predHeaderCopy}>
                <Text style={styles.predTitle}>Beklenen Fiyat Değişimleri</Text>
                <Text style={styles.predSubtitle}>Piyasa ve Brent petrol analiz sinyalleri</Text>
              </View>
            </View>
          </View>

          {/* 3 AYRI YAKIT TÜRÜ TAHMİN KARTI */}
          <View style={styles.predCardGrid}>
            {fuelPredictionsList.map((pred) => {
              const isHike = pred.direction === 'increase'
              const isCut = pred.direction === 'decrease'
              return (
                <View key={pred.key} style={styles.predFuelCard}>
                  <View style={styles.predFuelTop}>
                    <View style={styles.predFuelBadge}>
                      <MaterialCommunityIcons name={pred.icon} size={15} color={colors.white} />
                      <Text style={styles.predFuelName}>{pred.fuelName}</Text>
                    </View>
                    <View
                      style={[
                        styles.predStatusPill,
                        {
                          borderColor: pred.pillBorder,
                          backgroundColor: pred.pillBg,
                        },
                      ]}
                    >
                      <Text style={[styles.predStatusText, { color: pred.textColor }]}>
                        {isHike && pred.amountText !== '0.00 ₺'
                          ? `${pred.amountText} Zam`
                          : isCut && pred.amountText !== '0.00 ₺'
                          ? `${pred.amountText} İndirim`
                          : 'Sabit / Değişim Yok'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.predBottomRow}>
                    <Text style={styles.predTransitionText}>
                      {pred.currentPrice} ➔ <Text style={{ color: pred.textColor, fontWeight: '800' }}>{pred.expectedPrice}</Text>
                    </Text>
                    <View style={styles.predDateChip}>
                      <MaterialCommunityIcons name="clock-outline" size={11} color={colors.mutedSoft} />
                      <Text style={styles.predDateText}>{pred.targetDate}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>

          <Text style={styles.signalDisclaimer}>
            Son hesaplama: {marketSignal.updatedAt}
          </Text>
        </View>

        {/* Favori Şehirler Kıyaslaması Kartı */}
        <View style={styles.favCitiesCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.favCitiesTitleGroup}>
              <MaterialCommunityIcons name="heart" size={18} color="#FF4D4D" />
              <Text style={styles.sectionTitle}>Favori Şehir Fiyat Kıyaslaması</Text>
            </View>
            <Text style={styles.favCitiesSubText}>{favCities.length} şehir takipte</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favCitiesScroll}>
            {favoriteCityPrices.map((item) => (
              <View key={item.city} style={styles.favCityTile}>
                <View style={styles.favCityHeader}>
                  <MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.accent} />
                  <Text style={styles.favCityName}>{item.city}</Text>
                </View>
                <View style={styles.favCityPricesRow}>
                  <View style={styles.favCityPriceBox}>
                    <Text style={styles.favCityFuelType}>Benzin</Text>
                    <Text style={styles.favCityPriceVal}>{item.benzin ? `${item.benzin.toFixed(2)} ₺` : '--'}</Text>
                  </View>
                  <View style={styles.favCityPriceBox}>
                    <Text style={styles.favCityFuelType}>Motorin</Text>
                    <Text style={styles.favCityPriceVal}>{item.motorin ? `${item.motorin.toFixed(2)} ₺` : '--'}</Text>
                  </View>
                  <View style={styles.favCityPriceBox}>
                    <Text style={styles.favCityFuelType}>LPG</Text>
                    <Text style={styles.favCityPriceVal}>{item.lpg ? `${item.lpg.toFixed(2)} ₺` : '--'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Modern 7 Günlük Fiyat Trendi Kartı */}
        <View style={styles.modernTrendCard}>
          <View style={styles.trendHeader}>
            <View style={styles.trendHeaderLeft}>
              <Text style={styles.trendTitle}>7 Günlük Fiyat Trendi</Text>
              <Text style={styles.trendSubtitle}>Haftalık pompa değişim istatistikleri</Text>
            </View>
            <View style={[styles.trendBadge, chartMetrics.diff > 0 ? styles.trendBadgeUp : chartMetrics.diff < 0 ? styles.trendBadgeDown : styles.trendBadgeFlat]}>
              <MaterialCommunityIcons
                name={chartMetrics.diff > 0 ? 'trending-up' : chartMetrics.diff < 0 ? 'trending-down' : 'minus'}
                size={14}
                color={chartMetrics.diff > 0 ? colors.danger : chartMetrics.diff < 0 ? colors.accent : colors.muted}
              />
              <Text style={[styles.trendBadgeText, { color: chartMetrics.diff > 0 ? colors.danger : chartMetrics.diff < 0 ? colors.accent : colors.muted }]}>
                {chartMetrics.diff > 0 ? `+${chartMetrics.diff.toFixed(2)} ₺` : chartMetrics.diff < 0 ? `${chartMetrics.diff.toFixed(2)} ₺` : 'Sabit'}
              </Text>
            </View>
          </View>

          {/* Segmented Fuel Picker */}
          <View style={styles.segmentedRow}>
            {[
              { key: 'Benzin', label: 'Benzin 95', color: colors.accent },
              { key: 'Motorin', label: 'Motorin', color: colors.info },
              { key: 'LPG', label: 'LPG', color: colors.warning },
            ].map((fuel) => {
              const isActive = selectedChartFuelKey === fuel.key
              return (
                <Pressable
                  key={fuel.key}
                  onPress={() => setSelectedChartFuelKey(fuel.key)}
                  style={[styles.segmentBtn, isActive && { backgroundColor: colors.surfaceAlt, borderColor: fuel.color }]}
                >
                  <View style={[styles.segmentDot, { backgroundColor: fuel.color }]} />
                  <Text style={[styles.segmentText, isActive && { color: colors.text, fontWeight: '900' }]}>{fuel.label}</Text>
                </Pressable>
              )
            })}
          </View>

          {/* Modern Visual Bar Chart Container */}
          <View style={styles.barGraphBox}>
            {chartMetrics.items.map((item) => (
              <View key={item.day} style={styles.barColumn}>
                <Text style={[styles.barValText, item.isToday && styles.barValToday]}>
                  {item.value ? `${item.value.toFixed(1)}` : ''}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: item.barHeight,
                        backgroundColor: currentChartSeries.color,
                        opacity: item.isToday ? 1 : 0.7,
                      },
                      item.isToday && styles.barFillToday,
                    ]}
                  />
                </View>
                <Text style={[styles.barDayText, item.isToday && styles.barDayToday]}>{item.day}</Text>
              </View>
            ))}
          </View>

          {/* Clean 3-Metric Summary Footer */}
          <View style={styles.trendSummaryRow}>
            <View style={styles.trendMetricTile}>
              <Text style={styles.trendMetricLabel}>En Düşük</Text>
              <Text style={styles.trendMetricVal}>{chartMetrics.min ? `${chartMetrics.min.toFixed(2)} ₺` : '--'}</Text>
            </View>
            <View style={styles.trendMetricDivider} />
            <View style={styles.trendMetricTile}>
              <Text style={styles.trendMetricLabel}>En Yüksek</Text>
              <Text style={styles.trendMetricVal}>{chartMetrics.max ? `${chartMetrics.max.toFixed(2)} ₺` : '--'}</Text>
            </View>
            <View style={styles.trendMetricDivider} />
            <View style={styles.trendMetricTile}>
              <Text style={styles.trendMetricLabel}>Son Fiyat</Text>
              <Text style={[styles.trendMetricVal, { color: currentChartSeries.color }]}>
                {chartMetrics.last ? `${chartMetrics.last.toFixed(2)} ₺` : '--'}
              </Text>
            </View>
          </View>
        </View>
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
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  heroHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroPulseBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F223D',
    borderColor: 'rgba(56, 189, 248, 0.45)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  heroBrandTextCol: {
    justifyContent: 'center',
  },
  heroBrandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroBrandMain: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroBrandAccent: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroBrandSubtitle: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.2,
  },
  heroHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroRefreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  heroMetaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderColor: colors.border,
    borderWidth: 1,
  },
  heroDateText: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  heroUpdatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroUpdateText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  fuelHeroSection: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHeaderSub: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '600',
  },
  fuelCarouselScroll: {
    gap: 12,
    paddingRight: 16,
  },
  heroFuelTile: {
    width: 172,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 8,
    ...shadows.card,
  },
  heroFuelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroFuelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroFuelBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  heroChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  heroChangeBadgeUp: {
    backgroundColor: '#3A0D18',
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  heroChangeBadgeDown: {
    backgroundColor: '#064E3B',
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  heroChangeBadgeFlat: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  heroChangeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  heroFuelBody: {
    paddingVertical: 2,
  },
  heroFuelPrice: {
    color: colors.white,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroFuelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
    marginTop: 2,
  },
  heroFuelDateText: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '600',
  },
  heroFuelDiffSub: {
    fontSize: 11,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metaText: {
    color: colors.text,
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    paddingRight: 8,
  },
  updatePill: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  updateText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 5,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
    minHeight: 92,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...shadows.card,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardBody: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  price: {
    color: colors.white,
    flex: 1,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    paddingRight: 12,
  },
  changePill: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    minWidth: 76,
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  good: {
    backgroundColor: colors.accentDark,
  },
  bad: {
    backgroundColor: colors.dangerDark,
  },
  flat: {
    backgroundColor: '#26364F',
  },
  changeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 4,
  },
  goodText: {
    color: colors.accent,
  },
  badText: {
    color: colors.danger,
  },
  flatText: {
    color: colors.mutedSoft,
  },
  signalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 2,
    padding: 14,
    ...shadows.soft,
  },
  signalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  signalTitleGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    paddingRight: 10,
  },
  signalIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },
  signalTitleText: {
    flex: 1,
  },
  signalEyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  signalTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  signalPill: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 66,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  signalPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  signalSummary: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 12,
  },
  signalMetricRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingVertical: 10,
  },
  signalMetric: {
    flex: 1,
  },
  signalMetricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  signalMetricValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  analysisList: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  analysisRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    minHeight: 42,
    paddingVertical: 5,
  },
  analysisIcon: {
    alignItems: 'center',
    borderRadius: 7,
    height: 24,
    justifyContent: 'center',
    marginRight: 9,
    marginTop: 1,
    width: 24,
  },
  analysisTextGroup: {
    flex: 1,
  },
  analysisTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  analysisLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    paddingRight: 8,
  },
  analysisValue: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  analysisDetail: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  newsList: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 9,
  },
  newsTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
  },
  newsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    paddingVertical: 4,
  },
  newsText: {
    color: colors.mutedSoft,
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    marginLeft: 7,
  },
  newsPriceList: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 6,
  },
  newsPriceChip: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  newsPriceText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
  },
  fuelSignalList: {
    marginTop: 10,
  },
  fuelSignalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  fuelSignalName: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    paddingRight: 10,
  },
  fuelSignalFuel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 7,
  },
  fuelSignalValue: {
    color: colors.mutedSoft,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  signalDisclaimer: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 8,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 14,
    ...shadows.soft,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  chartArea: {
    alignItems: 'center',
    backgroundColor: '#071527',
    borderColor: '#223752',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },
  chartPlot: {
    position: 'relative',
  },
  chartBackdropTop: {
    backgroundColor: 'rgba(26, 45, 72, 0.42)',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    height: '46%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  chartBackdropBottom: {
    backgroundColor: 'rgba(7, 211, 156, 0.08)',
    bottom: 0,
    height: '42%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  gridGuide: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  gridLine: {
    backgroundColor: '#2A4161',
    flex: 1,
    height: 1,
    opacity: 0.72,
  },
  gridLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    marginLeft: 6,
    width: 32,
  },
  verticalGridLine: {
    backgroundColor: '#1C2D45',
    bottom: 0,
    opacity: 0.36,
    position: 'absolute',
    top: 0,
    width: 1,
  },
  lineLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  lineSegment: {
    borderRadius: 999,
    position: 'absolute',
  },
  lineSegmentGlow: {
    borderRadius: 999,
    height: 7,
    opacity: 0.14,
    position: 'absolute',
  },
  chartPoint: {
    borderRadius: 999,
    borderWidth: 2,
    height: 6,
    position: 'absolute',
    width: 6,
  },
  chartPointActive: {
    borderRadius: 999,
    borderWidth: 2,
    height: 10,
    position: 'absolute',
    width: 10,
    ...shadows.soft,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dayLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    width: 30,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
  },
  modernTrendCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    ...shadows.card,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trendHeaderLeft: {
    flex: 1,
  },
  trendTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  trendSubtitle: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.bgSoft,
    gap: 4,
  },
  trendBadgeUp: { backgroundColor: colors.dangerDark },
  trendBadgeDown: { backgroundColor: colors.accentDark },
  trendBadgeFlat: { backgroundColor: colors.bgSoft },
  trendBadgeText: { fontSize: 11, fontWeight: '900' },

  segmentedRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    height: 34,
    borderRadius: 7,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  segmentText: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
  },

  barGraphBox: {
    flexDirection: 'row',
    height: 125,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 4,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  barValToday: {
    color: colors.text,
    fontWeight: '900',
  },
  barTrack: {
    width: 18,
    height: 80,
    backgroundColor: colors.bgSoft,
    borderRadius: 9,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 9,
  },
  barFillToday: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  barDayText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  barDayToday: {
    color: colors.accent,
    fontWeight: '900',
  },

  trendSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSoft,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  trendMetricTile: {
    flex: 1,
    alignItems: 'center',
  },
  trendMetricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  trendMetricVal: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  trendMetricDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
  },
  chartFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  chartFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartFilterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chartFilterChipText: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  chartFilterChipTextActive: {
    color: colors.bg,
    fontWeight: '900',
  },
  chartTooltipBadge: {
    position: 'absolute',
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    ...shadows.card,
  },
  chartTooltipText: {
    color: colors.bg,
    fontSize: 9,
    fontWeight: '900',
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    marginHorizontal: 7,
    marginBottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  legendItemActive: {
    backgroundColor: colors.bgSoft,
  },
  legendDot: {
    borderRadius: 999,
    height: 7,
    marginRight: 6,
    width: 7,
  },
  legendValue: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 5,
  },
  favCitiesCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
    ...shadows.soft,
  },
  favCitiesTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  favCitiesSubText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  favCitiesScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  favCityTile: {
    width: 170,
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  favCityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  favCityName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  favCityPricesRow: {
    gap: 4,
  },
  favCityPriceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favCityFuelType: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  favCityPriceVal: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
  },
  triggeredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderLight,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    ...shadows.soft,
  },
  triggeredBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  triggeredBannerCopy: {
    flex: 1,
  },
  triggeredBannerTitle: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '800',
  },
  triggeredBannerText: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  predictionDashboard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 16,
    ...shadows.card,
  },
  predHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  predHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  predRadarIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predHeaderCopy: {
    flex: 1,
    gap: 1,
  },
  predTitle: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  predSubtitle: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '700',
  },
  predConfidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: colors.surfaceAlt,
  },
  predDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  predConfidenceText: {
    fontSize: 10,
    fontWeight: '900',
  },
  predCardGrid: {
    gap: 10,
    marginBottom: 12,
  },
  predFuelCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  predFuelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  predFuelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  predFuelName: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  predStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  predStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  predBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
  },
  predTransitionText: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  predDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  predDateText: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '700',
  },
  predMetricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  predMetricChip: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  predMetricChipLabel: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '700',
  },
  predMetricChipVal: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
  },
})
