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
    if (marketSignal?.fuelPredictions && Array.isArray(marketSignal.fuelPredictions) && marketSignal.fuelPredictions.length > 0) {
      return marketSignal.fuelPredictions
    }
    return buildDetailedFuelPredictions(marketSignal?.direction ?? 'increase', marketSignal?.score ?? 65, marketSignal?.confidence ?? 'medium')
  }, [marketSignal])

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
        <View style={styles.header}>
          <View style={styles.headerMark}>
            <MaterialCommunityIcons name="fuel" size={18} color={colors.accent} />
          </View>
          <Text style={styles.brand}>Yakıt Radar</Text>
          <View style={styles.headerActions}>
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
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{data.currentDateLabel}</Text>
          <View style={styles.updatePill}>
            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.accent} />
            <Text style={styles.updateText}>{getUpdateLabel(data, refreshing)}</Text>
          </View>
        </View>

        {triggeredAlerts.length > 0 ? (
          <View style={styles.triggeredBanner}>
            <View style={styles.triggeredBannerIcon}>
              <MaterialCommunityIcons name="bell-ring" size={20} color="#FFD700" />
            </View>
            <View style={styles.triggeredBannerCopy}>
              <Text style={styles.triggeredBannerTitle}>Piyasa Zam/İndirim Sinyali Tetiklendi!</Text>
              <Text style={styles.triggeredBannerText}>Akaryakıt piyasasında hareketlilik var. Aşağıdaki kartlardan yakıt bazlı tahmin detaylarını görün.</Text>
            </View>
          </View>
        ) : null}

        {fuels.map((fuel) => (
          <View key={fuel.name} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.badge, { backgroundColor: fuel.badgeColor }]}>
                <Text style={styles.badgeText}>{fuel.name}</Text>
              </View>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.mutedSoft} />
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.price} numberOfLines={1}>
                {fuel.price}
              </Text>
              <View style={[styles.changePill, styles[fuel.tone]]}>
                <MaterialCommunityIcons
                  name={fuel.tone === 'bad' ? 'arrow-up-bold' : fuel.tone === 'good' ? 'arrow-down-bold' : 'minus'}
                  size={12}
                  color={fuel.tone === 'flat' ? colors.mutedSoft : colors.white}
                />
                <Text style={[styles.changeText, styles[`${fuel.tone}Text`]]}>{fuel.change}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* YENİLEŞTİRİLMİŞ AKARYAKIT TAHMİN DASHBOARD'U */}
        <View style={styles.predictionDashboard}>
          <View style={styles.predHeader}>
            <View style={styles.predHeaderLeft}>
              <View style={[styles.predRadarIconBox, { backgroundColor: marketSignal.softColor }]}>
                <MaterialCommunityIcons name="radar" size={20} color={marketSignal.color} />
              </View>
              <View style={styles.predHeaderCopy}>
                <Text style={styles.predTitle}>Beklenen Akaryakıt Değişimleri</Text>
                <Text style={styles.predSubtitle}>Yapay Zeka Piyasa & Zam Tahmin Sinyali</Text>
              </View>
            </View>
            <View style={[styles.predConfidenceBadge, { borderColor: marketSignal.color }]}>
              <View style={[styles.predDot, { backgroundColor: marketSignal.color }]} />
              <Text style={[styles.predConfidenceText, { color: marketSignal.color }]}>
                {marketSignal.confidenceLabel} Güven
              </Text>
            </View>
          </View>

          {/* 3 AYRI YAKIT TÜRÜ TAHMİN KARTI (Benzin, Motorin, LPG) */}
          <View style={styles.predCardGrid}>
            {fuelPredictionsList.map((pred) => {
              return (
                <View key={pred.key} style={[styles.predFuelCard, { borderColor: pred.badgeBorder, backgroundColor: pred.badgeBg }]}>
                  <View style={styles.predFuelTop}>
                    <View style={styles.predFuelBadge}>
                      <MaterialCommunityIcons name={pred.icon} size={16} color={colors.white} />
                      <Text style={styles.predFuelName}>{pred.fuelName}</Text>
                    </View>
                    <View style={[styles.predStatusPill, { borderColor: pred.badgeBorder }]}>
                      <Text style={[styles.predStatusText, { color: pred.textColor }]}>
                        {pred.statusText}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.predAmountBox}>
                    <Text style={[styles.predAmountText, { color: pred.textColor }]}>
                      {pred.amountText}
                    </Text>
                    <Text style={styles.predUnitText}>/ litre beklenti</Text>
                  </View>

                  <View style={styles.predBottomRow}>
                    <View style={styles.predTransitionPill}>
                      <Text style={styles.predTransitionText}>
                        {pred.currentPrice} ➔ <Text style={{ color: pred.textColor, fontWeight: 'bold' }}>{pred.expectedPrice}</Text>
                      </Text>
                    </View>
                    <View style={styles.predDateChip}>
                      <MaterialCommunityIcons name="calendar-clock" size={12} color={colors.mutedSoft} />
                      <Text style={styles.predDateText}>{pred.targetDate}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>

          {/* SİNYAL METRİKLERİ HIZLI ÇİP BARI */}
          <View style={styles.predMetricsBar}>
            {marketSignal.metrics.map((metric) => (
              <View key={metric.label} style={styles.predMetricChip}>
                <Text style={styles.predMetricChipLabel}>{metric.label}:</Text>
                <Text style={styles.predMetricChipVal}>{metric.value}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.signalDisclaimer}>
            Son hesaplama: {marketSignal.updatedAt} · Tahmini sinyaldir, resmi pompa kararı değildir.
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
    paddingBottom: 24,
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
  brand: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '900',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    marginRight: 10,
    width: 34,
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
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  cardBody: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  price: {
    color: colors.text,
    flex: 1,
    fontSize: 30,
    fontWeight: '900',
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
    backgroundColor: '#382A00',
    borderColor: '#FFD700',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    ...shadows.soft,
  },
  triggeredBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#523E00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  triggeredBannerCopy: {
    flex: 1,
  },
  triggeredBannerTitle: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '900',
  },
  triggeredBannerText: {
    color: '#FFF5C2',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  predictionDashboard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
    ...shadows.soft,
  },
  predHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  predHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  predRadarIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predHeaderCopy: {
    gap: 1,
  },
  predTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
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
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
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
    backgroundColor: colors.surface,
  },
  predStatusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  predAmountBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  predAmountText: {
    fontSize: 26,
    fontWeight: '900',
  },
  predUnitText: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  predBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  predTransitionPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  predTransitionText: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
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
