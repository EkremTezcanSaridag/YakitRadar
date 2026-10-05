import { useMemo, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native'
import { colors, shadows } from '../theme'
import { useFuelData } from '../hooks/useFuelData'
import { buildHistoryView } from '../services/fuelData'

const historyPeriods = [
  { label: '7G', value: 7 },
  { label: '30G', value: 30 },
  { label: '90G', value: 90 },
  { label: 'Tümü', value: 'all' },
]

const fuelTabsConfig = [
  { key: 'benzin95', label: 'Benzin 95', icon: 'gas-station', color: '#38BDF8' },
  { key: 'motorin', label: 'Motorin', icon: 'truck-outline', color: '#F59E0B' },
  { key: 'lpg', label: 'LPG (Otogaz)', icon: 'fire', color: '#C084FC' },
]

export default function Gecmis() {
  const { data } = useFuelData()
  const [selectedFuelKey, setSelectedFuelKey] = useState('benzin95')
  const [period, setPeriod] = useState(7)
  const [inspectedIndex, setInspectedIndex] = useState(null)

  const historyView = useMemo(
    () => buildHistoryView(data.history, period, selectedFuelKey),
    [data.history, period, selectedFuelKey],
  )

  const activeFuelMeta = useMemo(
    () => fuelTabsConfig.find((f) => f.key === selectedFuelKey) ?? fuelTabsConfig[0],
    [selectedFuelKey],
  )

  const fuelValues = historyView.fuelValues || []
  const recentChanges = data.recentChanges || []

  // Ensure inspectedIndex stays within bounds or defaults to latest
  const activePoint =
    inspectedIndex !== null && fuelValues[inspectedIndex]
      ? fuelValues[inspectedIndex]
      : fuelValues[fuelValues.length - 1] ?? null

  const minPrice = historyView.minPrice || 0
  const maxPrice = historyView.maxPrice || 0
  const avgPrice = historyView.avgPrice || 0
  const periodDiff = historyView.periodDiff || 0
  const periodDiffPct = historyView.periodDiffPct || 0

  // Chart domain with comfortable padding
  const domainMin = Math.max(0, Math.floor(minPrice - 1))
  const domainMax = Math.ceil(maxPrice + 1)
  const domainSpan = domainMax - domainMin || 1

  const periodLabel = period === 'all' ? 'Tüm Zamanlar' : `Son ${period} Gün`

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* HEADER BAR */}
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

        {/* TITLE & PERIOD BADGE */}
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Fiyat Geçmişi</Text>
            <Text style={styles.subtitle}>{activeFuelMeta.label} için geçmiş fiyat değişim analizi.</Text>
          </View>
          <View style={styles.periodBadge}>
            <Text style={styles.periodBadgeText}>{periodLabel}</Text>
          </View>
        </View>

        {/* 3'LÜ YAKIT SEGMENTİ SEÇİCİ */}
        <View style={styles.fuelTabsRow}>
          {fuelTabsConfig.map((fuel) => {
            const isSelected = fuel.key === selectedFuelKey
            return (
              <Pressable
                key={fuel.key}
                onPress={() => {
                  setSelectedFuelKey(fuel.key)
                  setInspectedIndex(null)
                }}
                style={({ pressed }) => [
                  styles.fuelTab,
                  isSelected && [styles.fuelTabActive, { borderColor: fuel.color }],
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name={fuel.icon}
                  size={15}
                  color={isSelected ? fuel.color : colors.mutedSoft}
                />
                <Text style={[styles.fuelTabText, isSelected && { color: colors.white, fontWeight: '900' }]}>
                  {fuel.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* ZAMAN ARALIĞI SEÇİCİ (7G, 30G, 90G, Tümü) */}
        <View style={styles.periodSelector}>
          {historyPeriods.map((option) => {
            const isActive = option.value === period
            return (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                onPress={() => {
                  setPeriod(option.value)
                  setInspectedIndex(null)
                }}
                style={[styles.periodOption, isActive && styles.periodOptionActive]}
              >
                <Text style={[styles.periodOptionText, isActive && styles.periodOptionTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* YENİ NESİL MODERN FİYAT TREND GRAFİĞİ KARTI */}
        <View style={styles.chartCard}>
          {/* GRAFİK ÜST TEFTİŞ & BİLGİ ŞERİDİ */}
          <View style={styles.chartHeader}>
            <View>
              <View style={styles.chartFuelBadge}>
                <View style={[styles.fuelColorDot, { backgroundColor: activeFuelMeta.color }]} />
                <Text style={styles.chartFuelTitle}>{activeFuelMeta.label}</Text>
                {inspectedIndex !== null ? (
                  <Pressable onPress={() => setInspectedIndex(null)} style={styles.resetInspectBtn}>
                    <Text style={styles.resetInspectText}>Canlıya Dön</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.priceInspectorRow}>
                <Text style={styles.chartMainPrice}>
                  {activePoint ? `${activePoint.price.toFixed(2)} ₺` : '--'}
                </Text>
                <View
                  style={[
                    styles.diffBadge,
                    periodDiff > 0 ? styles.diffUp : periodDiff < 0 ? styles.diffDown : styles.diffFlat,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={periodDiff > 0 ? 'arrow-up-bold' : periodDiff < 0 ? 'arrow-down-bold' : 'minus'}
                    size={13}
                    color={periodDiff > 0 ? colors.danger : periodDiff < 0 ? colors.accent : colors.mutedSoft}
                  />
                  <Text
                    style={[
                      styles.diffBadgeText,
                      periodDiff > 0
                        ? styles.diffUpText
                        : periodDiff < 0
                        ? styles.diffDownText
                        : styles.diffFlatText,
                    ]}
                  >
                    {periodDiff > 0 ? `+${periodDiff.toFixed(2)} ₺` : `${periodDiff.toFixed(2)} ₺`}
                    {periodDiffPct !== 0 ? ` (%${Math.abs(periodDiffPct).toFixed(1)})` : ''}
                  </Text>
                </View>
              </View>

              <Text style={styles.inspectedDateSub}>
                {inspectedIndex !== null
                  ? `Seçilen gün: ${activePoint?.shortDate ?? ''}`
                  : `Son güncel veri · ${activePoint?.shortDate ?? ''}`}
              </Text>
            </View>

            <View style={styles.chartHeaderRightIcon}>
              <MaterialCommunityIcons name="chart-box-outline" size={24} color={colors.mutedSoft} />
            </View>
          </View>

          {/* SÜTUN GRAFİK GÖRSEL ALANI (HATA DÜZELTİLDİ: Y-Ekseni ayrıştırıldı, barlarla çakışma önlendi) */}
          <View style={styles.chartCanvasContainer}>
            {/* ÇİZİM VE BARLAR ALANI */}
            <View style={styles.chartPlotArea}>
              {/* YATAY KILAVUZ ÇİZGİLERİ (Sadece bar alanını kapsar) */}
              <View style={styles.gridLayer}>
                <View style={styles.gridGuideLine}>
                  <View style={styles.guideDashedLine} />
                </View>
                <View style={styles.gridGuideLine}>
                  <View style={styles.guideDashedLine} />
                </View>
                <View style={styles.gridGuideLine}>
                  <View style={styles.guideDashedLine} />
                </View>
              </View>

              {/* SÜTUNLAR BAR DİZİLİMİ */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.barsContainer}
              >
                {fuelValues.map((item, idx) => {
                  const isSelected =
                    inspectedIndex === idx || (inspectedIndex === null && idx === fuelValues.length - 1)
                  const price = item.price || 0
                  const ratio = Math.max(0.18, Math.min(1, (price - domainMin) / domainSpan))
                  const barHeightPercent = `${Math.round(ratio * 88)}%`

                  return (
                    <Pressable
                      key={`${item.date}-${idx}`}
                      onPress={() => setInspectedIndex(idx)}
                      style={styles.barColumn}
                    >
                      {/* EN TEPEDEKİ SEÇİLİ FİYAT BALONU */}
                      <View style={styles.tooltipSlot}>
                        {isSelected ? (
                          <View style={[styles.floatingTooltip, { borderColor: activeFuelMeta.color }]}>
                            <Text style={styles.floatingTooltipText}>{price.toFixed(2)}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* SÜTUN GÖVDESİ */}
                      <View
                        style={[
                          styles.barTrack,
                          isSelected && { borderColor: activeFuelMeta.color, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                        ]}
                      >
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: barHeightPercent,
                              backgroundColor: isSelected ? activeFuelMeta.color : `${activeFuelMeta.color}3D`,
                            },
                            isSelected && styles.barFillActive,
                          ]}
                        />
                      </View>

                      {/* TARİH ETİKETİ */}
                      <Text style={[styles.barDateLabel, isSelected && styles.barDateLabelActive]}>
                        {item.shortDate}
                      </Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>

            {/* BAĞIMSIZ SAĞ Y-EKSENİ (Barlarla ve tarih etiketleriyle asla çakışmaz) */}
            <View style={styles.yAxisColumn}>
              <Text style={styles.guideLabelText}>{domainMax.toFixed(1)} ₺</Text>
              <Text style={styles.guideLabelText}>{avgPrice ? avgPrice.toFixed(1) : '--'} ₺</Text>
              <Text style={styles.guideLabelText}>{domainMin.toFixed(1)} ₺</Text>
            </View>
          </View>
        </View>

        {/* 4 AYRI YÜKSEK KONTRAST METRİK KARTLARI (2x2 GRID) */}
        <View style={styles.metricsGrid}>
          {/* EN DÜŞÜK FİYAT */}
          <View style={styles.metricGridCard}>
            <View style={[styles.metricCardIconBox, { backgroundColor: '#0C2A4A' }]}>
              <MaterialCommunityIcons name="arrow-down-circle-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.metricGridLabel}>En Düşük Fiyat</Text>
            <Text style={styles.metricGridValue}>{minPrice ? `${minPrice.toFixed(2)} ₺` : '--'}</Text>
            <Text style={styles.metricGridSub}>{historyView.minDate ? `Tarih: ${historyView.minDate}` : 'Bu dönemde'}</Text>
          </View>

          {/* EN YÜKSEK FİYAT */}
          <View style={styles.metricGridCard}>
            <View style={[styles.metricCardIconBox, { backgroundColor: '#3A0D18' }]}>
              <MaterialCommunityIcons name="arrow-up-circle-outline" size={18} color={colors.danger} />
            </View>
            <Text style={styles.metricGridLabel}>En Yüksek Fiyat</Text>
            <Text style={styles.metricGridValue}>{maxPrice ? `${maxPrice.toFixed(2)} ₺` : '--'}</Text>
            <Text style={styles.metricGridSub}>{historyView.maxDate ? `Tarih: ${historyView.maxDate}` : 'Bu dönemde'}</Text>
          </View>

          {/* DÖNEM ORTALAMASI */}
          <View style={styles.metricGridCard}>
            <View style={[styles.metricCardIconBox, { backgroundColor: '#1E293B' }]}>
              <MaterialCommunityIcons name="scale-balance" size={18} color={colors.info} />
            </View>
            <Text style={styles.metricGridLabel}>Dönem Ortalaması</Text>
            <Text style={styles.metricGridValue}>{avgPrice ? `${avgPrice.toFixed(2)} ₺` : '--'}</Text>
            <Text style={styles.metricGridSub}>Hesaplanan ortalama</Text>
          </View>

          {/* DÖNEM DEĞİŞİMİ */}
          <View style={styles.metricGridCard}>
            <View style={[styles.metricCardIconBox, { backgroundColor: '#2C1E0A' }]}>
              <MaterialCommunityIcons name="chart-timeline-variant" size={18} color={colors.warning} />
            </View>
            <Text style={styles.metricGridLabel}>Dönem Değişimi</Text>
            <Text
              style={[
                styles.metricGridValue,
                periodDiff > 0 ? styles.diffUpText : periodDiff < 0 ? styles.diffDownText : styles.diffFlatText,
              ]}
            >
              {periodDiff > 0 ? `+${periodDiff.toFixed(2)} ₺` : `${periodDiff.toFixed(2)} ₺`}
            </Text>
            <Text style={styles.metricGridSub}>
              {periodDiff > 0 ? '▲ Net Artış' : periodDiff < 0 ? '▼ Net İndirim' : 'Dengeli Seyir'}
            </Text>
          </View>
        </View>

        {/* SON DEĞİŞİKLİKLER LİSTESİ */}
        <Text style={styles.changesTitle}>Son Değişiklikler</Text>

        <View style={styles.changesCard}>
          {recentChanges.length ? (
            recentChanges.map((change, index) => {
              const isHike = change.tone === 'up'
              return (
                <View
                  key={`${change.date}-${change.tag}-${index}`}
                  style={[styles.changeRow, index !== recentChanges.length - 1 && styles.changeDivider]}
                >
                  <View
                    style={[
                      styles.changeDotWrap,
                      { backgroundColor: isHike ? '#3A0D18' : '#0C2A4A' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isHike ? 'arrow-up-bold' : 'arrow-down-bold'}
                      size={14}
                      color={isHike ? colors.danger : colors.accent}
                    />
                  </View>
                  <View style={styles.changeCopy}>
                    <View style={styles.changeTitleRow}>
                      <Text style={styles.changeDate} numberOfLines={1}>
                        {change.date}
                      </Text>
                      <View style={styles.changeTag}>
                        <Text style={styles.changeTagText}>{change.tag}</Text>
                      </View>
                    </View>
                    <Text style={styles.changeDesc}>{change.desc}</Text>
                  </View>
                  <Text style={[styles.changeValue, isHike ? styles.changeUp : styles.changeDown]}>
                    {change.value}
                  </Text>
                </View>
              )
            })
          ) : (
            <View style={styles.emptyChanges}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={colors.mutedSoft} />
              <Text style={styles.emptyChangesText}>Yeni fiyat değişikliği bekleniyor.</Text>
            </View>
          )}
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
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.mutedSoft,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  periodBadge: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  periodBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
  },
  fuelTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  fuelTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  fuelTabActive: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
  },
  fuelTabText: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  periodSelector: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 14,
    padding: 3,
  },
  periodOption: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
    borderRadius: 7,
  },
  periodOptionActive: {
    backgroundColor: colors.accent,
  },
  periodOptionText: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  periodOptionTextActive: {
    color: colors.bg,
    fontWeight: '900',
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
    ...shadows.card,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartFuelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  fuelColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartFuelTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  resetInspectBtn: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  resetInspectText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  priceInspectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  chartMainPrice: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '900',
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  diffUp: {
    backgroundColor: '#3A0D18',
    borderColor: colors.danger,
  },
  diffDown: {
    backgroundColor: '#0C2A4A',
    borderColor: colors.accent,
  },
  diffFlat: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  diffBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  diffUpText: {
    color: colors.danger,
  },
  diffDownText: {
    color: colors.accent,
  },
  diffFlatText: {
    color: colors.mutedSoft,
  },
  inspectedDateSub: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '600',
  },
  chartHeaderRightIcon: {
    padding: 4,
  },
  chartCanvasContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 185,
  },
  chartPlotArea: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridLayer: {
    position: 'absolute',
    top: 26,
    bottom: 24,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  gridGuideLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guideDashedLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  yAxisColumn: {
    width: 44,
    paddingLeft: 6,
    paddingTop: 20,
    paddingBottom: 24,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  guideLabelText: {
    color: colors.mutedSoft,
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'right',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minWidth: '100%',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: 2,
    paddingHorizontal: 4,
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 38,
    paddingHorizontal: 4,
    height: 155,
  },
  tooltipSlot: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingTooltip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    ...shadows.soft,
  },
  floatingTooltipText: {
    color: colors.white,
    fontSize: 9.5,
    fontWeight: '900',
  },
  barTrack: {
    width: 14,
    height: 98,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barFillActive: {
    shadowColor: colors.white,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  barDateLabel: {
    color: colors.mutedSoft,
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  barDateLabelActive: {
    color: colors.white,
    fontWeight: '900',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metricGridCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    ...shadows.soft,
  },
  metricCardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricGridLabel: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  metricGridValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 3,
    marginBottom: 2,
  },
  metricGridSub: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  changesTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  changesCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    ...shadows.card,
  },
  emptyChanges: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 74,
    paddingHorizontal: 14,
  },
  emptyChangesText: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 9,
  },
  changeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  changeDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  changeDotWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    marginRight: 10,
    width: 30,
  },
  changeCopy: {
    flex: 1,
    paddingRight: 10,
  },
  changeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  changeDate: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  changeDesc: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  changeTag: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  changeTagText: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '800',
  },
  changeValue: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  changeUp: {
    color: colors.danger,
  },
  changeDown: {
    color: colors.accent,
  },
  pressed: {
    opacity: 0.85,
  },
})
