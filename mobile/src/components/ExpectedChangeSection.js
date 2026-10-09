import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { getExpectedChangeLayout } from '../services/expectedChange'
import { colors, radii, spacing, typography } from '../theme'

export default function ExpectedChangeSection({
  boxes,
  analysisTime,
  onRefresh,
  refreshing,
}) {
  if (!boxes?.length) {
    return null
  }

  const layout = getExpectedChangeLayout(boxes.length)

  return (
    <View style={styles.section}>
      <Text allowFontScaling style={styles.heading}>BEKLENEN DEĞİŞİM</Text>
      <View style={styles.grid}>
        {boxes.map((box, index) => (
          <View
            key={box.fuelKey}
            accessibilityLabel={box.accessibilityLabel}
            accessible
            style={[
              styles.box,
              layout[index],
              {
                backgroundColor: box.tokens.bg,
                borderColor: box.tokens.border,
              },
            ]}
          >
            <View style={styles.boxTopRow}>
              <Text allowFontScaling style={[styles.fuelName, { color: box.tokens.text }]}>
                {box.fuel}
              </Text>
              <Ionicons color={box.tokens.text} name={box.trendIcon} size={18} />
            </View>
            <Text allowFontScaling style={[styles.amount, { color: box.tokens.text }]}>
              {box.amountLabel}
            </Text>
            <Text allowFontScaling style={[styles.subtitle, { color: box.tokens.text }]}>
              {box.subtitle}
            </Text>
            {box.priceRangeLabel ? (
              <Text allowFontScaling style={styles.priceRange}>{box.priceRangeLabel}</Text>
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.footerRow}>
        <Text allowFontScaling style={styles.footerText}>
          Haberlere göre · analiz {analysisTime ?? '--:--'}
          {' · '}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={refreshing}
          hitSlop={8}
          onPress={onRefresh}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text allowFontScaling style={styles.footerAction}>
            {refreshing ? '…' : 'Yenile'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.section,
  },
  heading: {
    color: colors.mutedSoft,
    fontSize: typography.micro,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.cardGap,
  },
  box: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.cardPadding,
  },
  boxTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  fuelName: {
    fontSize: 13,
    fontWeight: '600',
  },
  amount: {
    fontSize: 32,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  priceRange: {
    color: colors.muted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  footerText: {
    color: colors.mutedSoft,
    fontSize: typography.caption,
  },
  footerAction: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
})
