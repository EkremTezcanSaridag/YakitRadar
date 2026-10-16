import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../theme'

export default function StatusBanner({ variant, text, actionLabel, onAction, busy = false }) {
  if (!text) {
    return null
  }

  const iconName = variant === 'stale' ? 'time-outline' : 'cloud-offline-outline'
  const iconColor = variant === 'stale' ? colors.toastWarning : colors.muted

  return (
    <View style={styles.banner}>
      <Ionicons color={iconColor} name={iconName} size={16} />
      <Text allowFontScaling style={styles.text}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed, busy && styles.disabled]}
        >
          <Text allowFontScaling style={styles.actionText}>{busy ? '…' : actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    color: colors.text,
    flex: 1,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  actionText: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
})
