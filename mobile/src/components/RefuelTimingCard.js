import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../theme'

const ACTION_ICON = {
  fill_now: 'flash-outline',
  wait: 'time-outline',
  neutral: 'help-circle-outline',
}

export default function RefuelTimingCard({ advice }) {
  if (!advice) {
    return null
  }

  const icon = ACTION_ICON[advice.action] ?? ACTION_ICON.neutral

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons color={colors.accent} name={icon} size={22} />
        <Text style={styles.title}>Şimdi doldur mu, bekle mi?</Text>
      </View>
      <Text style={styles.headline}>{advice.headline}</Text>
      <Text style={styles.detail}>{advice.detail}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {advice.fuelName} · güven: {advice.confidenceLabel || advice.confidence}
        </Text>
        {advice.expectedAmount ? (
          <Text style={styles.metaText}>Beklenen ~{advice.expectedAmount.toFixed(2)} ₺/L</Text>
        ) : null}
      </View>
      <Text style={styles.accuracy}>{advice.accuracy?.label ?? 'Yeterli veri yok'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    flex: 1,
  },
  headline: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  detail: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  accuracy: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
})
