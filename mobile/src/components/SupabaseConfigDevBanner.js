import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { hasSupabaseConfig } from '../supabase'
import { colors } from '../theme'

export function SupabaseConfigDevBanner() {
  const insets = useSafeAreaInsets()

  if (!__DEV__ || hasSupabaseConfig) {
    return null
  }

  return (
    <View style={[styles.banner, { paddingTop: Math.max(insets.top, 8) }]}>
      <Text style={styles.text}>
        Supabase yapılandırması eksik — örnek veriler gösteriliyor. mobile/.env dosyasını oluşturup
        EXPO_PUBLIC_SUPABASE_* değerlerini ekleyin ve Metro’yu yeniden başlatın.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningDark,
    borderBottomWidth: 2,
    borderBottomColor: colors.warning,
    paddingHorizontal: 12,
    paddingBottom: 10,
    zIndex: 100,
  },
  text: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
})
