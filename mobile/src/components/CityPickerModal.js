import { useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { getRealPriceRows, provinceNames } from '../services/fuelData'
import { colors, radii, spacing, typography } from '../theme'
import { matchesSearch } from '../utils/turkishSearch'

export default function CityPickerModal({
  excludeCities = [],
  onClose,
  onSelect,
  prices,
  selectedCity,
  visible,
}) {
  const [query, setQuery] = useState('')
  const [keyboardInset, setKeyboardInset] = useState(0)

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardInset(event.endCoordinates.height)
    })
    const hideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0))

    return () => {
      showListener.remove()
      hideListener.remove()
    }
  }, [])

  const cities = useMemo(() => {
    const realRows = getRealPriceRows(prices)
    const sourceRows = realRows.length > 0 ? realRows : provinceNames.map((city) => ({ city }))
    const excluded = new Set(excludeCities)

    return sourceRows
      .filter((row) => !excluded.has(row.city))
      .filter((row) => matchesSearch(query, row.city))
      .sort((a, b) => a.city.localeCompare(b.city, 'tr'))
  }, [excludeCities, prices, query])

  function handleSelect(cityName) {
    setQuery('')
    onSelect(cityName)
    onClose()
  }

  function handleClose() {
    setQuery('')
    onClose()
  }

  return (
    <Modal animationType="slide" onRequestClose={handleClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Şehir seç</Text>
            <Pressable accessibilityLabel="Kapat" hitSlop={12} onPress={handleClose}>
              <Ionicons color={colors.muted} name="close" size={24} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons color={colors.mutedSoft} name="search" size={18} />
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="İl ara…"
              placeholderTextColor={colors.mutedSoft}
              selectionColor={colors.accent}
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons color={colors.mutedSoft} name="close-circle" size={18} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={[styles.listContent, { paddingBottom: keyboardInset + spacing.md }]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            style={styles.list}
          >
            {cities.length === 0 ? (
              <Text style={styles.emptyText}>Gerçek fiyat verisi olan il bulunamadı.</Text>
            ) : (
              cities.map((row) => {
                const selected = row.city === selectedCity
                return (
                  <Pressable
                    key={row.city}
                    onPress={() => handleSelect(row.city)}
                    style={({ pressed }) => [
                      styles.row,
                      selected && styles.rowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.rowCity}>{row.city}</Text>
                    {selected ? (
                      <Ionicons color={colors.accent} name="checkmark" size={20} />
                    ) : null}
                  </Pressable>
                )
              })
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '68%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    paddingVertical: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.screen,
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.surfaceAlt,
    marginHorizontal: -spacing.screen,
    paddingHorizontal: spacing.screen,
  },
  rowCity: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
})
