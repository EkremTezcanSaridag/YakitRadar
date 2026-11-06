import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { CommonActions } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  ABOUT_DATA_NOTE,
  ABOUT_DISCLAIMER_BODY,
  FUEL_PRICE_LEGAL_SHORT,
  FUEL_PRICE_SOURCE_LINE,
} from '../constants/legalCopy'
import { colors, spacing, typography } from '../theme'

export default function Hakkinda({ navigation }) {
  const version = Constants.expoConfig?.version ?? '—'

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Geri"
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack()
                return
              }
              navigation.dispatch(
                CommonActions.navigate({
                  name: 'Bildirimler',
                  merge: true,
                }),
              )
            }}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>
          <Text style={styles.title}>Hakkında</Text>
        </View>

        <Text style={styles.version}>Sürüm {version}</Text>

        <Text style={styles.sectionTitle}>Fiyat verisi</Text>
        <Text style={styles.body}>{FUEL_PRICE_SOURCE_LINE}</Text>
        <Text style={styles.body}>{FUEL_PRICE_LEGAL_SHORT}</Text>

        <Text style={styles.sectionTitle}>Feragat</Text>
        <Text style={styles.body}>{ABOUT_DISCLAIMER_BODY}</Text>

        <Text style={styles.sectionTitle}>Veri ve gizlilik</Text>
        <Text style={styles.body}>{ABOUT_DATA_NOTE}</Text>
        <Text style={styles.body}>
          Tam metin depo kökündeki gizlilik politikası dosyasında yer alır; mağaza Data safety formu
          doldurulurken bildirim tokeni, anonim kurulum kimliği, platform ve bildirim tercihleri
          alanlarını bu metinle hizalayın.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  backBtn: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  version: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  body: {
    color: colors.mutedSoft,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
})
