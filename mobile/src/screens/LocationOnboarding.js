import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import CityPickerModal from '../components/CityPickerModal'
import { colors, radii, spacing, typography } from '../theme'
import { useFuelData } from '../hooks/useFuelData'
import { markPrimaryCityConfigured } from '../services/favoriteCities'
import { resolveHomeCityFromDeviceLocation } from '../services/locationCity'

export default function LocationOnboarding({ onComplete }) {
  const { data } = useFuelData()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function finishWithCity(cityName, source) {
    await markPrimaryCityConfigured(cityName, source)
    onComplete()
  }

  async function handleUseLocation() {
    setBusy(true)
    try {
      const city = await resolveHomeCityFromDeviceLocation()
      if (city) {
        await finishWithCity(city, 'location')
        return
      }
    } catch {
      // permission, timeout, or hardware error → manual picker
    }
    setBusy(false)
    setPickerOpen(true)
  }

  function handleManual() {
    setPickerOpen(true)
  }

  async function handlePickCity(cityName) {
    setPickerOpen(false)
    await finishWithCity(cityName, 'manual')
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons color={colors.accent} name="location-outline" size={40} />
        </View>
        <Text allowFontScaling style={styles.title}>Bulunduğun ilin fiyatını gösterelim</Text>
        <Text allowFontScaling style={styles.subtitle}>
          Konum yalnızca cihazında kullanılır; sunucuya gönderilmez.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={handleUseLocation}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && !busy && styles.primaryBtnPressed,
            busy && styles.btnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryBtnText}>Konumumu kullan</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={handleManual}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryBtnText}>Şehri kendim seçeyim</Text>
        </Pressable>
      </View>

      <CityPickerModal
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickCity}
        prices={data.prices}
        selectedCity={null}
        visible={pickerOpen}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: typography.display,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
    marginBottom: spacing.section,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.card,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  primaryBtnPressed: {
    backgroundColor: colors.accentPressed,
  },
  primaryBtnText: {
    color: colors.onAccent,
    fontSize: typography.body,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.88,
  },
})
