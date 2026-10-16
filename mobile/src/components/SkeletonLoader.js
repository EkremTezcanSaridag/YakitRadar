import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native'
import { colors, radii, spacing } from '../theme'

const PulseContext = createContext(null)

function usePulseOpacity() {
  return useContext(PulseContext)
}

function SkeletonBlock({ width = '100%', height = 16, radius = 8, style }) {
  const pulse = usePulseOpacity()
  const animatedStyle =
    typeof pulse === 'number'
      ? { opacity: pulse }
      : { opacity: pulse }

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { width, height, borderRadius: radius },
        animatedStyle,
        style,
      ]}
    />
  )
}

export function SkeletonGroup({ label = 'Yükleniyor', children }) {
  const pulse = useRef(new Animated.Value(0.55)).current
  const loopRef = useRef(null)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {})

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)

    return () => {
      subscription?.remove?.()
    }
  }, [])

  useEffect(() => {
    if (reduceMotion) {
      return undefined
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )

    loopRef.current = animation
    animation.start()

    return () => {
      animation.stop()
    }
  }, [pulse, reduceMotion])

  const pulseValue = reduceMotion ? 0.8 : pulse

  return (
    <PulseContext.Provider value={pulseValue}>
      <View
        accessibilityLabel={label}
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        accessible
      >
        {children}
      </View>
    </PulseContext.Provider>
  )
}

export function SkeletonHero() {
  return (
    <View style={styles.heroWrap}>
      <SkeletonBlock height={12} width={90} />
      <SkeletonBlock height={32} radius={8} style={styles.heroCity} width={170} />
      <SkeletonBlock height={48} radius={8} style={styles.heroPrice} width={190} />
      <SkeletonBlock height={16} radius={8} style={styles.heroFuel} width={70} />
    </View>
  )
}

export function SkeletonFuelChips() {
  return (
    <View style={styles.chipRow}>
      <SkeletonBlock height={44} radius={16} style={styles.chip} />
      <SkeletonBlock height={44} radius={16} style={styles.chip} />
      <SkeletonBlock height={44} radius={16} style={styles.chip} />
    </View>
  )
}

export function SkeletonRows({ count = 5 }) {
  return (
    <View>
      {Array.from({ length: count }, (_, index) => (
        <View key={`row-${index}`} style={[styles.row, index > 0 && styles.rowBorder]}>
          <SkeletonBlock height={16} width={120} />
          <SkeletonBlock height={16} width={80} />
        </View>
      ))}
    </View>
  )
}

export function SkeletonChart() {
  return (
    <View>
      <SkeletonBlock height={160} radius={12} width="100%" />
      <View style={styles.chartStats}>
        {Array.from({ length: 3 }, (_, index) => (
          <View key={`stat-${index}`} style={styles.chartStatCol}>
            <SkeletonBlock height={10} width={60} />
            <SkeletonBlock height={16} style={styles.chartStatValue} width={56} />
          </View>
        ))}
      </View>
    </View>
  )
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBlock height={16} width="80%" />
      <SkeletonBlock height={16} style={styles.cardLine} width="65%" />
      <SkeletonBlock height={16} width="50%" />
    </View>
  )
}

export { SkeletonBlock }

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.skeleton,
  },
  heroWrap: {
    marginBottom: spacing.xl,
  },
  heroCity: {
    marginTop: spacing.sm,
  },
  heroPrice: {
    marginTop: spacing.lg,
  },
  heroFuel: {
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.section,
  },
  chip: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  rowBorder: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  chartStatCol: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  chartStatValue: {
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.cardPadding,
    gap: spacing.sm,
  },
  cardLine: {
    marginVertical: spacing.xs,
  },
})
