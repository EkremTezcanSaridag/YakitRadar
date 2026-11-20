import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../theme'

export default function NotificationPermissionPrompt({ busy = false, onAccept, onDecline, visible }) {
  return (
    <Modal animationType="fade" onRequestClose={onDecline} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessible={false} onPress={onDecline} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons color={colors.accent} name="notifications-outline" size={32} />
          </View>

          <Text allowFontScaling style={styles.title}>
            Fiyat değişimlerini kaçırma
          </Text>
          <Text allowFontScaling style={styles.body}>
            Seçtiğin illerde benzin, motorin ve LPG fiyatı değiştiğinde haber verelim. İzni
            istediğin zaman Bildirimler ekranından kapatabilirsin.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onAccept}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !busy && styles.primaryButtonPressed,
              busy && styles.buttonDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text allowFontScaling style={styles.primaryButtonText}>
                Bildirimleri aç
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onDecline}
            style={({ pressed }) => [styles.secondaryButton, pressed && !busy && styles.pressed]}
          >
            <Text allowFontScaling style={styles.secondaryButtonText}>
              Şimdi değil
            </Text>
          </Pressable>

          <Text allowFontScaling style={styles.note}>
            Bildirim izni olmadan da fiyatları ve geçmiş grafikleri kullanmaya devam edebilirsin.
          </Text>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.screen,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.xl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.card,
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.card,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonPressed: {
    backgroundColor: colors.accentPressed,
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontSize: typography.body,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: radii.card,
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSoft,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.88,
  },
  note: {
    color: colors.mutedSoft,
    fontSize: typography.caption,
    lineHeight: 18,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
})
