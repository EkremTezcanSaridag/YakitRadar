import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../theme'

export default function EmptyState({
  icon = 'cloud-offline-outline',
  title,
  message,
  onRetry,
  retryLabel = 'Tekrar dene',
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons color={colors.mutedSoft} name={icon} size={32} />
      <Text allowFontScaling style={styles.title}>{title}</Text>
      {message ? (
        <Text allowFontScaling style={styles.message}>{message}</Text>
      ) : null}
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        >
          <Text allowFontScaling style={styles.retryLabel}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    color: colors.mutedSoft,
    fontSize: typography.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
})
