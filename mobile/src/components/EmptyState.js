import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../theme'

const defaultIcons = {
  empty: 'search-outline',
  error: 'alert-circle-outline',
  offline: 'cloud-offline-outline',
}

function iconColor(variant) {
  if (variant === 'error') {
    return colors.priceRise
  }

  return colors.muted
}

export default function EmptyState({
  variant = 'empty',
  icon,
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
  busy = false,
}) {
  const iconName = icon ?? defaultIcons[variant] ?? defaultIcons.empty
  const liveRegion = variant === 'error' ? 'polite' : undefined

  return (
    <View
      accessibilityLiveRegion={liveRegion}
      accessible={false}
      style={[styles.wrap, compact && styles.wrapCompact]}
    >
      <View style={[styles.iconShell, compact && styles.iconShellCompact]}>
        <Ionicons color={iconColor(variant)} name={iconName} size={compact ? 22 : 28} />
      </View>
      <Text
        accessibilityRole="header"
        allowFontScaling
        style={[styles.title, compact && styles.titleCompact]}
      >
        {title}
      </Text>
      {message ? (
        <Text allowFontScaling style={[styles.message, compact && styles.messageCompact]}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onAction}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Text allowFontScaling style={styles.primaryLabel}>{actionLabel}</Text>
          )}
        </Pressable>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSecondary}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text allowFontScaling style={styles.secondaryLabel}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    maxWidth: 320,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    alignSelf: 'center',
    width: '100%',
  },
  wrapCompact: {
    paddingVertical: spacing.xl,
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 32,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  iconShellCompact: {
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '600',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: typography.body,
    marginTop: spacing.md,
  },
  message: {
    color: colors.mutedAccessible,
    fontSize: typography.body,
    lineHeight: 22,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  messageCompact: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.card,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
  },
  primaryLabel: {
    color: colors.onAccent,
    fontSize: typography.body,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
  },
  secondaryLabel: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
})
