import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { shouldShowOfflineBanner } from '../services/fuelDataPersistence'
import { colors, radii, spacing, typography } from '../theme'

export default function OfflineDataBanner({ fuelData, onRetry, refreshing = false }) {
  if (!shouldShowOfflineBanner(fuelData)) {
    return null
  }

  return (
    <View style={styles.banner}>
      <Ionicons color={colors.warning} name="cloud-offline-outline" size={18} />
      <Text allowFontScaling style={styles.text}>
        Çevrimdışı – son güncelleme: {fuelData.cacheSavedAtLabel}
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          disabled={refreshing}
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed, refreshing && styles.disabled]}
        >
          <Text allowFontScaling style={styles.retryText}>{refreshing ? '…' : 'Tekrar dene'}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '500',
    minWidth: 160,
  },
  retry: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  retryText: {
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
