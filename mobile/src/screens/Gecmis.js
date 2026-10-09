import { useMemo, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import ScreenHeader from '../components/ScreenHeader'
import { colors, radii, spacing, typography } from '../theme'
import { useFuelData } from '../hooks/useFuelData'
import { buildHistoryView } from '../services/fuelData'

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

  const activeFuel = fuelTabsConfig.find((fuel) => fuel.key === selectedFuelKey) ?? fuelTabsConfig[0]

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

        <View style={styles.fuelRow}>
          {fuelTabsConfig.map((fuel) => {
            const active = fuel.key === selectedFuelKey
            return (
              <Pressable
                key={fuel.key}
                onPress={() => setSelectedFuelKey(fuel.key)}
                style={({ pressed }) => [
                  styles.fuelChip,
                  active && styles.fuelChipActive,
                  active && pressed && styles.fuelChipPressed,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name={fuel.icon} size={16} color={active ? colors.onAccent : colors.muted} />
                <Text style={[styles.fuelChipText, active && styles.fuelChipTextActive]}>{fuel.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.chartHeader}>
          <Text style={styles.chartPrice}>{latest ? `${latest.price.toFixed(2)}` : '--'}</Text>
          <Text style={styles.chartUnit}>₺/L · {activeFuel.label}</Text>
          <Text style={styles.chartMeta}>
            {historyView.periodDiff >= 0 ? '+' : ''}
            {historyView.periodDiff?.toFixed(2) ?? '0.00'} ₺ dönem içi
          </Text>
        </View>

        <View style={[styles.chartCanvas, { width: chartWidth }]}>
          {segments.map((segment, index) => (
            <View
              key={`seg-${index}`}
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
          {points.map((point, index) => (
            <View
              key={`pt-${index}`}
              style={[
                styles.lineDot,
                index === points.length - 1 && styles.lineDotActive,
                { left: point.x - 3, top: point.y - 3 },
              ]}
            />
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>En düşük</Text>
            <Text style={styles.statValue}>{historyView.minPrice?.toFixed(2) ?? '--'}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Ortalama</Text>
            <Text style={styles.statValue}>{historyView.avgPrice?.toFixed(2) ?? '--'}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>En yüksek</Text>
            <Text style={styles.statValue}>{historyView.maxPrice?.toFixed(2) ?? '--'}</Text>
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
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  fuelChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
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
    fontSize: typography.micro,
    fontWeight: '600',
  },
  fuelChipTextActive: {
    color: colors.onAccent,
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
  chartCanvas: {
    height: CHART_HEIGHT,
    marginBottom: spacing.xl,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  lineDotActive: {
    backgroundColor: colors.accent,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -1,
    marginTop: -1,
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
