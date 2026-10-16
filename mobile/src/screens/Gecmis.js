import { useEffect, useMemo, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import ScreenHeader from '../components/ScreenHeader'
import { fuelSelectorChipStyles } from '../styles/fuelSelectorChipStyles'
import { colors, radii, spacing, typography } from '../theme'
import { useFuelData } from '../hooks/useFuelData'
import { buildHistoryView } from '../services/fuelData'
import {
  clampChartTooltipLeft,
  formatHistoryChartTooltipDate,
  pickNearestChartPointIndex,
} from '../utils/chartNearestPoint'
import { formatDecimalTr, formatSignedCurrencyTr } from '../utils/priceFormat'

const historyPeriods = [
  { label: '7G', value: 7 },
  { label: '30G', value: 30 },
  { label: '90G', value: 90 },
]

const fuelTabsConfig = [
  { key: 'benzin95', label: 'Benzin', icon: 'car-sport-outline' },
  { key: 'motorin', label: 'Motorin', icon: 'bus-outline' },
  { key: 'lpg', label: 'LPG', icon: 'flame-outline' },
]

const CHART_HEIGHT = 160
const TOOLTIP_ESTIMATED_WIDTH = 168

function buildLineGeometry(values, width) {
  const padding = 12
  const usableWidth = Math.max(width - padding * 2, 1)
  const usableHeight = CHART_HEIGHT - padding * 2
  const prices = values.map((item) => item.price).filter((price) => price > 0)

  if (!prices.length) {
    return { points: [], segments: [] }
  }

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = Math.max(max - min, 0.05)

  const points = values.map((item, index) => {
    const price = item.price || min
    const x = padding + (index / Math.max(values.length - 1, 1)) * usableWidth
    const y = padding + ((max - price) / span) * usableHeight
    return { x, y }
  })

  const segments = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1]
    const dx = next.x - point.x
    const dy = next.y - point.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)

    return {
      angle,
      left: point.x + dx / 2 - length / 2,
      top: point.y + dy / 2 - 1,
      width: length,
    }
  })

  return { points, segments }
}

export default function Gecmis() {
  const { width: windowWidth } = useWindowDimensions()
  const { data } = useFuelData()
  const [selectedFuelKey, setSelectedFuelKey] = useState('benzin95')
  const [period, setPeriod] = useState(7)
  const [selectedPointIndex, setSelectedPointIndex] = useState(-1)
  const [tooltipWidth, setTooltipWidth] = useState(TOOLTIP_ESTIMATED_WIDTH)

  const chartWidth = Math.max(280, windowWidth - spacing.screen * 2)

  const historyView = useMemo(
    () => buildHistoryView(data.history, period, selectedFuelKey),
    [data.history, period, selectedFuelKey],
  )

  const fuelValues = historyView.fuelValues || []
  const latest = fuelValues[fuelValues.length - 1]
  const { segments, points } = useMemo(
    () => buildLineGeometry(fuelValues, chartWidth),
    [fuelValues, chartWidth],
  )

  useEffect(() => {
    if (!fuelValues.length) {
      setSelectedPointIndex(-1)
      return
    }
    setSelectedPointIndex(fuelValues.length - 1)
  }, [fuelValues, period, selectedFuelKey])

  const pointsRef = useRef(points)
  pointsRef.current = points

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => pointsRef.current.length > 0,
        onMoveShouldSetPanResponder: () => pointsRef.current.length > 0,
        onPanResponderGrant: (event) => {
          const index = pickNearestChartPointIndex(event.nativeEvent.locationX, pointsRef.current)
          if (index >= 0) {
            setSelectedPointIndex(index)
          }
        },
        onPanResponderMove: (event) => {
          const index = pickNearestChartPointIndex(event.nativeEvent.locationX, pointsRef.current)
          if (index >= 0) {
            setSelectedPointIndex(index)
          }
        },
      }),
    [],
  )

  const activeFuel = fuelTabsConfig.find((fuel) => fuel.key === selectedFuelKey) ?? fuelTabsConfig[0]
  const selectedValue = selectedPointIndex >= 0 ? fuelValues[selectedPointIndex] : null
  const selectedPoint = selectedPointIndex >= 0 ? points[selectedPointIndex] : null
  const previousValue = selectedPointIndex > 0 ? fuelValues[selectedPointIndex - 1] : null
  const dayDiff =
    selectedValue && previousValue ? selectedValue.price - previousValue.price : null

  const tooltipLeft =
    selectedPoint
      ? clampChartTooltipLeft(selectedPoint.x, tooltipWidth, chartWidth)
      : spacing.sm

  const chartAccessibilityLabel = selectedValue
    ? `${formatDecimalTr(selectedValue.price)} lira, ${formatHistoryChartTooltipDate(selectedValue.date)}${
        Number.isFinite(dayDiff) ? `, dünden fark ${formatSignedCurrencyTr(dayDiff)}` : ''
      }`
    : 'Fiyat grafiği'

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Geçmiş" />

        <View style={styles.periodRow}>
          {historyPeriods.map((item) => {
            const active = period === item.value
            return (
              <Pressable
                key={item.label}
                onPress={() => setPeriod(item.value)}
                style={({ pressed }) => [styles.periodChip, active && styles.periodChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>{item.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <View style={[fuelSelectorChipStyles.fuelRow, styles.fuelRow]}>
          {fuelTabsConfig.map((fuel) => {
            const active = fuel.key === selectedFuelKey
            return (
              <Pressable
                key={fuel.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedFuelKey(fuel.key)}
                style={({ pressed }) => [
                  fuelSelectorChipStyles.fuelChip,
                  active && fuelSelectorChipStyles.fuelChipActive,
                  active && pressed && fuelSelectorChipStyles.fuelChipPressed,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name={fuel.icon} size={16} color={active ? colors.onAccent : colors.muted} />
                <Text
                  style={[fuelSelectorChipStyles.fuelChipText, active && fuelSelectorChipStyles.fuelChipTextActive]}
                >
                  {fuel.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.chartHeader}>
          <Text style={styles.chartPrice}>{latest ? formatDecimalTr(latest.price) : '--'}</Text>
          <Text style={styles.chartUnit}>₺/L · {activeFuel.label}</Text>
          <Text
            style={[
              styles.chartMeta,
              historyView.periodDiff > 0 && styles.chartMetaRise,
              historyView.periodDiff < 0 && styles.chartMetaFall,
            ]}
          >
            {Number.isFinite(historyView.periodDiff)
              ? `${formatSignedCurrencyTr(historyView.periodDiff)} dönem içi`
              : '0,00 ₺ dönem içi'}
          </Text>
        </View>

        <View
          accessibilityLabel={chartAccessibilityLabel}
          accessibilityRole="adjustable"
          style={[styles.chartCanvas, { width: chartWidth }]}
          {...panResponder.panHandlers}
        >
          {selectedPoint ? (
            <View
              pointerEvents="none"
              style={[styles.chartGuideLine, { left: selectedPoint.x - 0.5 }]}
            />
          ) : null}
          {segments.map((segment, index) => (
            <View
              key={`seg-${index}`}
              pointerEvents="none"
              style={[
                styles.lineSegment,
                {
                  left: segment.left,
                  top: segment.top,
                  width: segment.width,
                  transform: [{ rotate: `${segment.angle}deg` }],
                },
              ]}
            />
          ))}
          {points.map((point, index) => {
            const selected = index === selectedPointIndex
            return (
              <View
                key={`pt-${index}`}
                pointerEvents="none"
                style={[
                  styles.lineDot,
                  selected && styles.lineDotSelected,
                  { left: point.x - (selected ? 5 : 3), top: point.y - (selected ? 5 : 3) },
                ]}
              />
            )
          })}
          {selectedValue && selectedPoint ? (
            <View
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width
                if (width > 0) {
                  setTooltipWidth(width)
                }
              }}
              pointerEvents="none"
              style={[
                styles.chartTooltip,
                {
                  left: tooltipLeft,
                  top: Math.max(0, selectedPoint.y - 52),
                },
              ]}
            >
              <Text style={styles.chartTooltipMain}>
                {formatDecimalTr(selectedValue.price)} ₺ · {formatHistoryChartTooltipDate(selectedValue.date)}
              </Text>
              {Number.isFinite(dayDiff) ? (
                <Text
                  style={[
                    styles.chartTooltipDiff,
                    dayDiff > 0 && styles.chartTooltipDiffRise,
                    dayDiff < 0 && styles.chartTooltipDiffFall,
                  ]}
                >
                  Dünden fark: {formatSignedCurrencyTr(dayDiff)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>En düşük</Text>
            <Text style={styles.statValue}>{formatDecimalTr(historyView.minPrice)}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Ortalama</Text>
            <Text style={styles.statValue}>{formatDecimalTr(historyView.avgPrice)}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>En yüksek</Text>
            <Text style={styles.statValue}>{formatDecimalTr(historyView.maxPrice)}</Text>
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
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: 96,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  periodChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  periodChipText: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  periodChipTextActive: {
    color: colors.accent,
  },
  fuelRow: {
    marginBottom: spacing.xl,
  },
  chartHeader: {
    marginBottom: spacing.lg,
  },
  chartPrice: {
    color: colors.text,
    fontSize: typography.display,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chartUnit: {
    color: colors.muted,
    fontSize: typography.body,
    marginTop: spacing.xs,
  },
  chartMeta: {
    color: colors.mutedSoft,
    fontSize: typography.caption,
    marginTop: spacing.sm,
  },
  chartMetaRise: {
    color: colors.priceRise,
  },
  chartMetaFall: {
    color: colors.priceFall,
  },
  chartCanvas: {
    height: CHART_HEIGHT,
    marginBottom: spacing.xl,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chartGuideLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.accentSoft,
  },
  chartTooltip: {
    position: 'absolute',
    maxWidth: '92%',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chartTooltipMain: {
    color: colors.text,
    fontSize: typography.caption,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  chartTooltipDiff: {
    color: colors.muted,
    fontSize: typography.micro,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  chartTooltipDiffRise: {
    color: colors.priceRise,
  },
  chartTooltipDiffFall: {
    color: colors.priceFall,
  },
  lineSegment: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
  lineDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  lineDotSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accentSoft,
    borderRadius: 5,
    borderWidth: 4,
    height: 10,
    width: 10,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  statCell: {
    flex: 1,
  },
  statLabel: {
    color: colors.mutedSoft,
    fontSize: typography.micro,
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.88,
  },
})
