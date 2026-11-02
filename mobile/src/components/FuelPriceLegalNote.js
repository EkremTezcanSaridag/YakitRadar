import { StyleSheet, Text, View } from 'react-native'
import { FUEL_PRICE_LEGAL_SHORT, FUEL_PRICE_SOURCE_LINE } from '../constants/legalCopy'
import { colors, spacing, typography } from '../theme'

export default function FuelPriceLegalNote({ compact = false }) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text allowFontScaling style={styles.line}>
        {FUEL_PRICE_SOURCE_LINE}
      </Text>
      {!compact ? (
        <Text allowFontScaling style={styles.lineSecondary}>
          {FUEL_PRICE_LEGAL_SHORT}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  wrapCompact: {
    marginBottom: spacing.sm,
  },
  line: {
    color: colors.mutedSoft,
    fontSize: typography.micro,
    fontWeight: '600',
    lineHeight: 16,
  },
  lineSecondary: {
    color: colors.muted,
    fontSize: typography.micro,
    fontWeight: '500',
    lineHeight: 16,
  },
})
