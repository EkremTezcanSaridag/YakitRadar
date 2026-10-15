import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../theme'

export default function ExpectedChangeEmptyNote() {
  return (
    <View style={styles.row}>
      <Ionicons accessibilityElementsHidden color={colors.accent} name="ellipse" size={6} />
      <Text accessibilityRole="text" allowFontScaling style={styles.text}>
        Beklenen değişiklik yok
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.section,
  },
  text: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '500',
  },
})
