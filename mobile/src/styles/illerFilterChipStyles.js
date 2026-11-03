import { StyleSheet } from 'react-native'
import { colors } from '../theme'
import { ILLER_FILTER_CHIP_HEIGHT } from './illerFilterChipLayout'

export { ILLER_FILTER_CHIP_HEIGHT } from './illerFilterChipLayout'

export const illerFilterChipStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: ILLER_FILTER_CHIP_HEIGHT,
    justifyContent: 'center',
    marginRight: 8,
    paddingHorizontal: 12,
  },
  chipText: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 16,
  },
  chipFuelActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipFuelTextActive: {
    color: colors.onAccent,
  },
  chipFavoriteActive: {
    backgroundColor: colors.favoriteSoft,
    borderColor: colors.favorite,
  },
  chipFavoriteTextActive: {
    color: colors.favorite,
  },
})
