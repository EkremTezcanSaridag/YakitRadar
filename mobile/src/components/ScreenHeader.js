import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFuelData } from '../hooks/useFuelData'
import { colors, iconSize, radii, spacing, typography } from '../theme'

export default function ScreenHeader({ showRefresh = false, title }) {
  const { data, refresh, refreshing } = useFuelData()

  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderRow}>
        <View style={styles.copy}>
          <Text allowFontScaling style={styles.screenTitle}>{title}</Text>
          <Text allowFontScaling style={styles.screenSubtitle}>
            {refreshing ? 'Yenileniyor…' : `Son kontrol: ${data.lastUpdatedHm ?? '--:--'}`}
          </Text>
          {!refreshing && data.dataCheckStale ? (
            <View style={styles.staleRow}>
              <Ionicons color={colors.mutedSoft} name="time-outline" size={14} />
              <Text allowFontScaling style={styles.staleDataNote}>Veri eski olabilir</Text>
            </View>
          ) : null}
        </View>
        {showRefresh ? (
          <Pressable
            accessibilityLabel="Fiyatları yenile"
            onPress={refresh}
            style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={iconSize.tab}
              color={refreshing ? colors.mutedSoft : colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screenHeader: {
    marginBottom: spacing.section,
  },
  screenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  screenTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
    textAlign: 'left',
  },
  screenSubtitle: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '400',
    marginTop: spacing.xs,
    textAlign: 'left',
  },
  staleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  staleDataNote: {
    color: colors.mutedSoft,
    fontSize: typography.caption,
    fontWeight: '400',
    textAlign: 'left',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
})
