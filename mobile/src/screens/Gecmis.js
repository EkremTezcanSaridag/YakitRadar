import { Fragment, useMemo, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScrollView, View, Text, StyleSheet, useWindowDimensions, Pressable } from 'react-native'
import { colors, shadows } from '../theme'
import { useFuelData } from '../hooks/useFuelData'
import { buildHistoryView } from '../services/fuelData'

const chartHeight = 146
const historyPeriods = [
  { label: '7G', value: 7 },
  { label: '30G', value: 30 },
  { label: '90G', value: 90 },
  { label: 'Tumu', value: 'all' },
]
function buildPoints(values, chartWidth, chartDomain) {
  const horizontalPadding = 8
  const verticalPadding = 12
  const usableWidth = chartWidth - horizontalPadding * 2
  const usableHeight = chartHeight - verticalPadding * 2
  const step = usableWidth / (values.length - 1)

  return values.map((value, index) => ({
    x: horizontalPadding + index * step,
    y:
      verticalPadding +
      ((chartDomain.max - value) / (chartDomain.max - chartDomain.min)) * usableHeight,
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

function buildChartGuides(chartDomain) {
  const middle = (chartDomain.min + chartDomain.max) / 2

  return [
    { label: `${Math.round(chartDomain.max)} TL`, top: 24 },
    { label: `${Math.round(middle)} TL`, top: 72 },
    { label: `${Math.round(chartDomain.min)} TL`, top: 120 },
  ]
}

function guideLeft(index, count, chartWidth, padding) {
  if (count <= 1) {
    return chartWidth / 2
  }

  return padding + (index * (chartWidth - padding * 2)) / (count - 1)
}

export default function Gecmis() {
  const { width } = useWindowDimensions()
  const { data } = useFuelData()
  const [period, setPeriod] = useState(30)
  const historyView = useMemo(() => buildHistoryView(data.history, period), [data.history, period])
  const trendSeries = historyView.trendSeries
  const chartLabels = historyView.chartLabels
  const chartDomain = historyView.chartDomain
  const metrics = historyView.metrics
  const recentChanges = data.recentChanges
  const periodLabel = period === 'all' ? 'Tumu' : `${period} Gun`
  const historySubtitle = period === 'all' ? 'Tum kayitlarin akaryakit degisim trendleri.' : `Son ${period} gunluk akaryakit degisim trendleri.`
  const chartWidth = Math.max(218, Math.min(width - 92, 330))
  const chartGuides = useMemo(() => buildChartGuides(chartDomain), [chartDomain])

  const chartSeries = useMemo(
    () =>
      trendSeries.map((series) => {
        const points = buildPoints(series.values, chartWidth, chartDomain)

        return {
          ...series,
          points,
          segments: buildSegments(points, series.strokeWidth),
        }
      }),
    [chartDomain, chartWidth, trendSeries],
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerMark}>
            <MaterialCommunityIcons name="chart-line" size={18} color={colors.accent} />
          </View>
          <Text style={styles.brand}>Yakıt Radar</Text>
          <View style={{ width: 18 }} />
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Fiyat Geçmişi</Text>
            <Text style={styles.subtitle}>{historySubtitle}</Text>
          </View>
          <View style={styles.periodBadge}>
            <Text style={styles.periodBadgeText}>{periodLabel}</Text>
          </View>
        </View>

        <View style={styles.periodSelector}>
          {historyPeriods.map((option) => {
            const isActive = option.value === period

            return (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                onPress={() => setPeriod(option.value)}
                style={[styles.periodOption, isActive && styles.periodOptionActive]}
              >
                <Text style={[styles.periodOptionText, isActive && styles.periodOptionTextActive]}>{option.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.trendCard}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.sectionLabel}>Aylık Trend</Text>
              <View style={styles.legendRow}>
                {trendSeries.map((item) => (
                  <View key={item.key} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>{item.key}</Text>
                  </View>
                ))}
              </View>
            </View>
            <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={colors.mutedSoft} />
          </View>

          <View style={styles.chartBox}>
            <View style={[styles.chartPlot, { width: chartWidth, height: chartHeight }]}>
              {chartLabels.map((label, index) => (
                <View
                  key={`${label}-${index}-guide`}
                  style={[
                    styles.verticalGridLine,
                    {
                      left: guideLeft(index, chartLabels.length, chartWidth, 8),
                    },
                  ]}
                />
              ))}

              {chartGuides.map((guide) => (
                <View key={guide.label} style={[styles.gridGuide, { top: guide.top }]}>
                  <View style={styles.gridLine} />
                  <Text style={styles.gridLabel}>{guide.label}</Text>
                </View>
              ))}

              {chartSeries.map((series) => (
                <View key={series.key} style={styles.lineLayer}>
                  {series.segments.map((segment, index) => (
                    <Fragment key={`${series.key}-${index}`}>
                      <View
                        style={[
                          styles.lineSegmentGlow,
                          {
                            backgroundColor: series.color,
                            left: segment.left,
                            top: segment.top - 2,
                            transform: [{ rotate: `${segment.angle}deg` }],
                            width: segment.width,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.lineSegment,
                          {
                            backgroundColor: series.color,
                            height: series.strokeWidth,
                            left: segment.left,
                            top: segment.top,
                            transform: [{ rotate: `${segment.angle}deg` }],
                            width: segment.width,
                          },
                        ]}
                      />
                    </Fragment>
                  ))}
                  {series.points.map((point, index) => (
                    <View
                      key={`${series.key}-point-${index}`}
                      style={[
                        index === series.points.length - 1 ? styles.chartPointActive : styles.chartPoint,
                        {
                          backgroundColor: series.key === 'Benzin' ? series.color : colors.bg,
                          borderColor: series.color,
                          left: point.x - (index === series.points.length - 1 ? 5 : 3),
                          top: point.y - (index === series.points.length - 1 ? 5 : 3),
                        },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>

            <View style={[styles.chartLabels, { width: chartWidth }]}>
              {chartLabels.map((label, index) => (
                <Text key={`${label}-${index}`} style={styles.chartLabel}>
                  {label}
                </Text>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.metricsRow}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metricCard}>
              <View style={[styles.metricIcon, metric.tone === 'info' && styles.metricIconInfo]}>
                <MaterialCommunityIcons
                  name={metric.icon}
                  size={17}
                  color={metric.tone === 'info' ? colors.info : colors.accent}
                />
              </View>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.changesTitle}>Son Değişiklikler</Text>

        <View style={styles.changesCard}>
          {recentChanges.length ? (
            recentChanges.map((change, index) => (
              <View
                key={`${change.date}-${change.tag}-${index}`}
                style={[styles.changeRow, index !== recentChanges.length - 1 && styles.changeDivider]}
              >
                <View style={styles.changeDotWrap}>
                  <MaterialCommunityIcons
                    name={change.tone === 'up' ? 'arrow-up-bold' : 'arrow-down-bold'}
                    size={14}
                    color={change.tone === 'up' ? colors.warning : colors.accent}
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
                <Text style={[styles.changeValue, change.tone === 'up' ? styles.changeUp : styles.changeDown]}>
                  {change.value}
                </Text>
              </View>
            ))
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
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  periodBadge: {
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  periodBadgeText: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '900',
  },
  periodSelector: {
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 3,
  },
  periodOption: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 32,
  },
  periodOptionActive: {
    backgroundColor: colors.accent,
    borderRadius: 6,
  },
  periodOptionText: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '900',
  },
  periodOptionTextActive: {
    color: colors.bg,
  },
  trendCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    ...shadows.card,
  },
  cardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    marginRight: 12,
    marginBottom: 6,
  },
  legendDot: {
    borderRadius: 999,
    height: 7,
    marginRight: 6,
    width: 7,
  },
  legendText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  chartBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
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
    height: '48%',
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
    width: 28,
  },
  verticalGridLine: {
    backgroundColor: '#1C2D45',
    bottom: 0,
    opacity: 0.32,
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
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chartLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    width: 58,
  },
  metricsRow: {
    flexDirection: 'row',
    marginHorizontal: -5,
    marginTop: 12,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    marginHorizontal: 5,
    padding: 12,
    ...shadows.soft,
  },
  metricIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentDark,
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    marginBottom: 10,
    width: 34,
  },
  metricIconInfo: {
    backgroundColor: '#172C4A',
  },
  metricLabel: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  changesTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 22,
    marginBottom: 10,
  },
  changesCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
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
    minHeight: 74,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  changeDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  changeDotWrap: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
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
  },
  changeDate: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    marginRight: 8,
  },
  changeDesc: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  changeTag: {
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  changeTagText: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '900',
  },
  changeValue: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    width: 74,
  },
  changeUp: {
    color: colors.danger,
  },
  changeDown: {
    color: colors.accent,
  },
})
