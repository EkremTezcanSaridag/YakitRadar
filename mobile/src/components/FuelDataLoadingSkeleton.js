import { StyleSheet, View } from 'react-native'
import { colors, radii, spacing } from '../theme'

function SkeletonBar({ style }) {
  return <View style={[styles.bar, style]} />
}

export default function FuelDataLoadingSkeleton() {
  return (
    <View style={styles.wrap}>
      <SkeletonBar style={styles.eyebrow} />
      <SkeletonBar style={styles.title} />
      <SkeletonBar style={styles.price} />
      <SkeletonBar style={styles.chipRow} />
      <SkeletonBar style={styles.listRow} />
      <SkeletonBar style={styles.listRow} />
      <SkeletonBar style={styles.listRowShort} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    marginBottom: spacing.section,
  },
  bar: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.7,
  },
  eyebrow: {
    width: 96,
    height: 14,
  },
  title: {
    width: '55%',
    height: 36,
  },
  price: {
    width: '70%',
    height: 52,
  },
  chipRow: {
    width: '100%',
    height: 44,
  },
  listRow: {
    width: '100%',
    height: 56,
  },
  listRowShort: {
    width: '85%',
    height: 56,
  },
})
