import { StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '../theme'

export const fuelSelectorChipStyles = StyleSheet.create({
  fuelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fuelChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fuelChipInline: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'center',
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
    fontSize: typography.caption,
    fontWeight: '600',
  },
  fuelChipTextActive: {
    color: colors.onAccent,
  },
})
