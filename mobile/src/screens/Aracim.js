import { useEffect, useMemo, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { fuelTabs } from '../services/fuelData'
import {
  addVehicleExpenseRecord,
  defaultVehicleProfile,
  deleteVehicleExpenseRecord,
  fuelStations,
  loadVehicleExpenseHistory,
  loadVehicleProfile,
  saveVehicleProfile,
} from '../services/vehicleProfile'
import { useFuelData } from '../hooks/useFuelData'
import { colors, shadows } from '../theme'

function toNumber(value) {
  const parsed = Number.parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function formatCurrency(value) {
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
}

function formatNumber(value) {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

function formatHistoryDate(value) {
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function buildMonthlyExpenses(history) {
  const today = new Date()

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1)
    const year = date.getFullYear()
    const month = date.getMonth()
    const total = history
      .filter((record) => {
        const recordDate = new Date(record.createdAt)
        return recordDate.getFullYear() === year && recordDate.getMonth() === month
      })
      .reduce((sum, record) => sum + (Number(record.spentAmount) || 0), 0)

    return {
      key: `${year}-${month}`,
      label: date.toLocaleDateString('tr-TR', { month: 'short' }).replace('.', ''),
      total,
    }
  })
}

function ResultRow({ icon, label, value }) {
  return (
    <View style={styles.resultRow}>
      <View style={styles.resultRowStart}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.accent} />
        <Text style={styles.resultRowLabel}>{label}</Text>
      </View>
      <Text style={styles.resultRowValue}>{value}</Text>
    </View>
  )
}

export default function Aracim() {
  const { data, refresh, refreshing } = useFuelData()
  const [profile, setProfile] = useState(defaultVehicleProfile)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [expenseHistory, setExpenseHistory] = useState([])

  // Receipt Modal Form State
  const [receiptStation, setReceiptStation] = useState('Shell')
  const [receiptFuelKey, setReceiptFuelKey] = useState('benzin95')
  const [receiptAmount, setReceiptAmount] = useState('')
  const [receiptLiters, setReceiptLiters] = useState('')
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptPayment, setReceiptPayment] = useState('Kredi Kartı')

  useEffect(() => {
    let mounted = true
    loadVehicleProfile().then((storedProfile) => {
      if (mounted) {
        setProfile(storedProfile)
      }
    })
    loadVehicleExpenseHistory().then((history) => {
      if (mounted) {
        setExpenseHistory(history)
      }
    })
    return () => { mounted = false }
  }, [])

  const selectedFuel = fuelTabs.find((fuel) => fuel.key === profile.fuelKey) ?? fuelTabs[0]
  const selectedCity = data.prices.find((item) => item.city === profile.city) ?? data.prices[0]
  const price = Number(selectedCity?.[profile.fuelKey]) || 0
  const spentAmount = toNumber(profile.spentAmount)
  const distanceKm = toNumber(profile.distanceKm)
  const calculations = useMemo(() => {
    const costPerKm = distanceKm > 0 ? spentAmount / distanceKm : 0
    const purchasedLiters = price > 0 ? spentAmount / price : 0
    return {
      costPerKm,
      costPer100Km: costPerKm * 100,
      purchasedLiters,
      estimatedConsumption: distanceKm > 0 ? (purchasedLiters / distanceKm) * 100 : 0,
    }
  }, [distanceKm, price, spentAmount])
  const filteredCities = useMemo(() => {
    const query = cityQuery.trim().toLocaleLowerCase('tr-TR')
    return query ? data.prices.filter((item) => item.city.toLocaleLowerCase('tr-TR').includes(query)) : data.prices
  }, [cityQuery, data.prices])
  const monthlyExpenses = useMemo(() => buildMonthlyExpenses(expenseHistory), [expenseHistory])
  const monthlyMaximum = Math.max(...monthlyExpenses.map((item) => item.total), 1)
  const currentMonthExpense = monthlyExpenses[monthlyExpenses.length - 1]?.total ?? 0

  const computedReceiptPricePerLiter = useMemo(() => {
    const amt = toNumber(receiptAmount)
    const ltr = toNumber(receiptLiters)
    return ltr > 0 ? amt / ltr : 0
  }, [receiptAmount, receiptLiters])

  function handleReceiptAmountChange(val) {
    setReceiptAmount(val)
    const numAmt = toNumber(val)
    const activeFuelPrice = Number(selectedCity?.[receiptFuelKey]) || price
    if (numAmt > 0 && activeFuelPrice > 0) {
      setReceiptLiters((numAmt / activeFuelPrice).toFixed(2))
    } else if (!val) {
      setReceiptLiters('')
    }
  }

  function handleReceiptLitersChange(val) {
    setReceiptLiters(val)
    const numLtr = toNumber(val)
    const activeFuelPrice = Number(selectedCity?.[receiptFuelKey]) || price
    if (numLtr > 0 && activeFuelPrice > 0 && !receiptAmount) {
      setReceiptAmount((numLtr * activeFuelPrice).toFixed(2))
    }
  }

  function handleReceiptFuelChange(fuelKey) {
    setReceiptFuelKey(fuelKey)
    const numAmt = toNumber(receiptAmount)
    const activeFuelPrice = Number(selectedCity?.[fuelKey]) || price
    if (numAmt > 0 && activeFuelPrice > 0) {
      setReceiptLiters((numAmt / activeFuelPrice).toFixed(2))
    }
  }

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  async function handleSave() {
    await saveVehicleProfile(profile)
    if (spentAmount > 0 && distanceKm > 0 && price > 0) {
      const nextHistory = await addVehicleExpenseRecord({
        city: selectedCity?.city ?? profile.city,
        costPerKm: calculations.costPerKm,
        distanceKm,
        fuelKey: profile.fuelKey,
        fuelTitle: selectedFuel.title,
        price,
        spentAmount,
        station: 'Sürüş Hesabı',
      })
      setExpenseHistory(nextHistory)
    }
    setResultOpen(true)
  }

  async function handleAddReceipt() {
    const amt = toNumber(receiptAmount)
    const ltr = toNumber(receiptLiters)

    if (amt <= 0) {
      Alert.alert('Eksik Bilgi', 'Lütfen harcanan tutarı giriniz.')
      return
    }

    const selectedFuelMeta = fuelTabs.find((f) => f.key === receiptFuelKey) ?? selectedFuel

    const nextHistory = await addVehicleExpenseRecord({
      city: selectedCity?.city ?? profile.city,
      distanceKm: 0,
      fuelKey: receiptFuelKey,
      fuelTitle: selectedFuelMeta.title,
      liters: ltr,
      notes: receiptNotes.trim(),
      paymentMethod: receiptPayment,
      price: computedReceiptPricePerLiter > 0 ? computedReceiptPricePerLiter : price,
      spentAmount: amt,
      station: receiptStation,
    })

    setExpenseHistory(nextHistory)
    setReceiptModalOpen(false)
    setReceiptAmount('')
    setReceiptLiters('')
    setReceiptNotes('')
    Alert.alert('Fiş Kaydedildi', `${receiptStation} yakıt alımı gider geçmişinize eklendi.`)
  }

  async function handleDeleteRecord(id) {
    Alert.alert('Fişi Sil', 'Bu gider kaydını silmek istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const nextHistory = await deleteVehicleExpenseRecord(id)
          setExpenseHistory(nextHistory)
        },
      },
    ])
  }

  function selectCity(city) {
    updateProfile('city', city)
    setCityPickerOpen(false)
    setCityQuery('')
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerMark}><MaterialCommunityIcons name="car-outline" size={21} color={colors.accent} /></View>
          <View style={styles.headerText}>
            <Text style={styles.brand}>Aracım</Text>
            <Text style={styles.subtitle}>Yakıt maliyetini ve fişlerini takip et</Text>
          </View>
          <Pressable accessibilityLabel="Fiyatları yenile" onPress={refresh} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="refresh" size={19} color={refreshing ? colors.muted : colors.accent} />
          </Pressable>
        </View>

        <View style={styles.priceStrip}>
          <View style={styles.priceStripIcon}><MaterialCommunityIcons name={selectedFuel.icon} size={17} color={colors.accent} /></View>
          <View style={styles.priceStripText}>
            <Text style={styles.priceStripLabel}>{selectedCity?.city ?? profile.city} · {selectedFuel.title}</Text>
            <Text style={styles.priceStripValue}>{formatCurrency(price)} / L</Text>
          </View>
          <Text style={styles.liveLabel}>{refreshing ? 'YENİLENİYOR' : 'CANLI'}</Text>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <Pressable onPress={() => setReceiptModalOpen(true)} style={({ pressed }) => [styles.receiptActionButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="receipt" size={18} color={colors.bg} />
            <Text style={styles.receiptActionButtonText}>+ Yakıt Fişi / Alımı Ekle</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Sürüş hesabı</Text>
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Yakıt türü</Text>
          <View style={styles.fuelSelector}>
            {fuelTabs.map((fuel) => {
              const selected = fuel.key === profile.fuelKey
              return (
                <Pressable key={fuel.key} onPress={() => updateProfile('fuelKey', fuel.key)} style={({ pressed }) => [styles.fuelOption, selected && styles.fuelOptionActive, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name={fuel.icon} size={17} color={selected ? colors.bg : colors.mutedSoft} />
                  <Text style={[styles.fuelOptionText, selected && styles.fuelOptionTextActive]}>{fuel.label}</Text>
                </Pressable>
              )
            })}
          </View>
          <Text style={styles.fieldLabel}>Şehir</Text>
          <Pressable accessibilityLabel="Şehir seç" onPress={() => setCityPickerOpen(true)} style={({ pressed }) => [styles.cityButton, pressed && styles.pressed]}>
            <View style={styles.cityButtonStart}>
              <MaterialCommunityIcons name="map-marker-outline" size={19} color={colors.accent} />
              <Text style={styles.cityButtonText}>{selectedCity?.city ?? profile.city}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={21} color={colors.muted} />
          </Pressable>
          <Text style={styles.fieldLabel}>Harcanan tutar</Text>
          <View style={styles.inputShell}>
            <TextInput value={profile.spentAmount} onChangeText={(value) => updateProfile('spentAmount', value)} keyboardType="decimal-pad" placeholder="500" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.unit}>TL</Text>
          </View>
          <Text style={styles.fieldLabel}>Gidilen mesafe</Text>
          <View style={styles.inputShell}>
            <TextInput value={profile.distanceKm} onChangeText={(value) => updateProfile('distanceKm', value)} keyboardType="decimal-pad" placeholder="300" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.unit}>km</Text>
          </View>
        </View>
        <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="calculator-variant-outline" size={18} color={colors.bg} />
          <Text style={styles.saveButtonText}>Hesapla & Kaydet</Text>
        </Pressable>

        <View style={styles.expenseHeading}>
          <View style={styles.expenseTitleGroup}>
            <Text style={styles.expenseTitle}>Aylık Maliyet</Text>
            <Text style={styles.expenseSubtitle}>Son 6 ayda kaydedilen yakıt harcamaları</Text>
          </View>
          <View style={styles.monthTotal}>
            <Text style={styles.monthTotalLabel}>Bu Ay</Text>
            <Text style={styles.monthTotalValue}>{formatCurrency(currentMonthExpense)}</Text>
          </View>
        </View>

        <View style={styles.expenseChartCard}>
          <View style={styles.expenseChartTop}>
            <View style={styles.expenseChartTitleRow}>
              <MaterialCommunityIcons name="chart-bar" size={18} color={colors.accent} />
              <Text style={styles.expenseChartTitle}>Yakıt Gideri Trendi</Text>
            </View>
            <Text style={styles.expenseChartSubText}>Son 6 Ay</Text>
          </View>
          <View style={styles.barChart}>
            {monthlyExpenses.map((month) => {
              const heightPct = Math.max((month.total / monthlyMaximum) * 100, month.total > 0 ? 8 : 4)
              return (
                <View key={month.key} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${heightPct}%` }]} />
                  </View>
                  <Text style={styles.barLabel}>{month.label}</Text>
                  <Text style={styles.barValue}>{month.total > 0 ? `${formatNumber(month.total)} TL` : '-'}</Text>
                </View>
              )
            })}
          </View>
        </View>

        <View style={styles.historyTop}>
          <Text style={styles.expenseTitle}>Fiş ve Gider Geçmişi</Text>
          <Text style={styles.historyCount}>{expenseHistory.length} kayıt</Text>
        </View>
        <View style={styles.historyCard}>
          {expenseHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <MaterialCommunityIcons name="receipt-text-outline" size={23} color={colors.muted} />
              <Text style={styles.emptyHistoryText}>Henüz fiş veya gider kaydı yok. "+ Yakıt Fişi Ekle" butonundan yeni fiş girebilirsiniz.</Text>
            </View>
          ) : (
            expenseHistory.slice(0, 10).map((record, index) => {
              const stationMeta = fuelStations.find((s) => s.name.toLowerCase() === (record.station || '').toLowerCase()) ?? fuelStations[0]
              return (
                <View key={record.id} style={[styles.historyRow, index === 0 && styles.historyRowFirst]}>
                  <View style={[styles.historyIcon, { backgroundColor: colors.surfaceAlt }]}>
                    <MaterialCommunityIcons name={stationMeta.icon} size={18} color={colors.accent} />
                  </View>
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyTitle}>{record.station ?? 'İstasyon'} · {record.city} · {record.fuelTitle}</Text>
                    <Text style={styles.historyMeta}>
                      {formatHistoryDate(record.createdAt)}
                      {record.liters ? ` · ${record.liters} L` : record.distanceKm ? ` · ${record.distanceKm} km` : ''}
                      {record.paymentMethod ? ` · ${record.paymentMethod}` : ''}
                    </Text>
                    {record.notes ? <Text style={styles.historyNotes}>"{record.notes}"</Text> : null}
                  </View>
                  <View style={styles.historyEnd}>
                    <Text style={styles.historyAmountValue}>{formatCurrency(Number(record.spentAmount) || 0)}</Text>
                    <Pressable onPress={() => handleDeleteRecord(record.id)} style={styles.deleteButton}>
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              )
            })
          )}
        </View>
      </ScrollView>

      {/* Add Fuel Receipt Modal */}
      <Modal animationType="slide" visible={receiptModalOpen} transparent onRequestClose={() => setReceiptModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReceiptModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <MaterialCommunityIcons name="receipt-text" size={22} color={colors.accent} />
                <Text style={styles.modalTitle}>Yakıt Fişi / Alımı Ekle</Text>
              </View>
              <Pressable accessibilityLabel="Kapat" onPress={() => setReceiptModalOpen(false)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>İstasyon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stationChipsContainer}>
                {fuelStations.map((st) => {
                  const isSelected = receiptStation === st.name
                  return (
                    <Pressable
                      key={st.id}
                      onPress={() => setReceiptStation(st.name)}
                      style={[styles.stationChip, isSelected && styles.stationChipActive]}
                    >
                      <MaterialCommunityIcons name={st.icon} size={15} color={isSelected ? colors.bg : colors.text} />
                      <Text style={[styles.stationChipText, isSelected && styles.stationChipTextActive]}>{st.name}</Text>
                    </Pressable>
                  )
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Yakıt türü</Text>
              <View style={styles.fuelSelector}>
                {fuelTabs.map((fuel) => {
                  const selected = fuel.key === receiptFuelKey
                  return (
                    <Pressable key={fuel.key} onPress={() => handleReceiptFuelChange(fuel.key)} style={[styles.fuelOption, selected && styles.fuelOptionActive]}>
                      <MaterialCommunityIcons name={fuel.icon} size={16} color={selected ? colors.bg : colors.mutedSoft} />
                      <Text style={[styles.fuelOptionText, selected && styles.fuelOptionTextActive]}>{fuel.label}</Text>
                    </Pressable>
                  )
                })}
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Harcanan Tutar</Text>
                  <View style={styles.inputShell}>
                    <TextInput value={receiptAmount} onChangeText={handleReceiptAmountChange} keyboardType="decimal-pad" placeholder="1000" placeholderTextColor={colors.muted} style={styles.input} />
                    <Text style={styles.unit}>TL</Text>
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Alınan Litre</Text>
                  <View style={styles.inputShell}>
                    <TextInput value={receiptLiters} onChangeText={handleReceiptLitersChange} keyboardType="decimal-pad" placeholder="13.8" placeholderTextColor={colors.muted} style={styles.input} />
                    <Text style={styles.unit}>L</Text>
                  </View>
                </View>
              </View>

              {computedReceiptPricePerLiter > 0 ? (
                <View style={styles.calcBadge}>
                  <Text style={styles.calcBadgeText}>Hesaplanan Birim Fiyat: <Text style={{ color: colors.accent, fontWeight: '900' }}>{formatCurrency(computedReceiptPricePerLiter)} / L</Text></Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>Ödeme Yöntemi</Text>
              <View style={styles.fuelSelector}>
                {['Kredi Kartı', 'Nakit'].map((method) => {
                  const isSelected = receiptPayment === method
                  return (
                    <Pressable key={method} onPress={() => setReceiptPayment(method)} style={[styles.fuelOption, isSelected && styles.fuelOptionActive]}>
                      <MaterialCommunityIcons name={method === 'Kredi Kartı' ? 'credit-card-outline' : 'cash-multiple'} size={16} color={isSelected ? colors.bg : colors.mutedSoft} />
                      <Text style={[styles.fuelOptionText, isSelected && styles.fuelOptionTextActive]}>{method}</Text>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={styles.fieldLabel}>Fiş Notu (İsteğe Bağlı)</Text>
              <View style={styles.inputShell}>
                <TextInput value={receiptNotes} onChangeText={setReceiptNotes} placeholder="Örn: Shell Kadıköy - Şehir dışı seyahat öncesi" placeholderTextColor={colors.muted} style={styles.input} />
              </View>

              <Pressable onPress={handleAddReceipt} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, { marginTop: 18 }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={19} color={colors.bg} />
                <Text style={styles.saveButtonText}>Fişi Kaydet</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* City Picker Modal */}
      <Modal animationType="slide" visible={cityPickerOpen} transparent onRequestClose={() => setCityPickerOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCityPickerOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Şehir seç</Text>
              <Pressable accessibilityLabel="Şehir seçiciyi kapat" onPress={() => setCityPickerOpen(false)} style={styles.closeButton}><MaterialCommunityIcons name="close" size={20} color={colors.text} /></Pressable>
            </View>
            <View style={styles.searchShell}>
              <MaterialCommunityIcons name="magnify" size={19} color={colors.muted} />
              <TextInput autoFocus value={cityQuery} onChangeText={setCityQuery} placeholder="İl ara" placeholderTextColor={colors.muted} style={styles.searchInput} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {filteredCities.map((city) => (
                <Pressable key={city.city} onPress={() => selectCity(city.city)} style={styles.cityOption}>
                  <Text style={styles.cityOptionName}>{city.city}</Text>
                  <View style={styles.cityOptionEnd}>
                    <Text style={styles.cityOptionPrice}>{formatCurrency(Number(city[profile.fuelKey]) || 0)}</Text>
                    {city.city === profile.city ? <MaterialCommunityIcons name="check" size={18} color={colors.accent} /> : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Drive Calculation Summary Modal */}
      <Modal animationType="fade" visible={resultOpen} transparent onRequestClose={() => setResultOpen(false)}>
        <View style={styles.resultBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setResultOpen(false)} />
          <View style={styles.resultSheet}>
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.resultTitle}>Maliyet özeti</Text>
                <Text style={styles.resultSubtitle}>{selectedCity?.city ?? profile.city} · {selectedFuel.title}</Text>
              </View>
              <Pressable accessibilityLabel="Maliyet özetini kapat" onPress={() => setResultOpen(false)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.primaryResult}>
              <Text style={styles.primaryResultLabel}>Km başına maliyet</Text>
              <Text style={styles.primaryResultValue}>{formatCurrency(calculations.costPerKm)}</Text>
            </View>
            <View style={styles.resultRows}>
              <ResultRow icon="speedometer" label="100 km maliyeti" value={formatCurrency(calculations.costPer100Km)} />
              <ResultRow icon="gas-station" label="Alınan yakıt" value={`${formatNumber(calculations.purchasedLiters)} L`} />
              <ResultRow icon="chart-line" label="Hesaplanan tüketim" value={`${formatNumber(calculations.estimatedConsumption)} L / 100 km`} />
            </View>
            <Pressable onPress={() => setResultOpen(false)} style={({ pressed }) => [styles.resultCloseAction, pressed && styles.pressed]}>
              <Text style={styles.resultCloseActionText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerMark: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, marginLeft: 10 }, brand: { color: colors.text, fontSize: 20, fontWeight: '800' }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  iconButton: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }, pressed: { opacity: 0.72 },
  priceStrip: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 8, minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', ...shadows.soft },
  priceStripIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }, priceStripText: { flex: 1, marginLeft: 10 }, priceStripLabel: { color: colors.mutedSoft, fontSize: 12, fontWeight: '700' }, priceStripValue: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 3 }, liveLabel: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  actionRow: { marginTop: 14, marginBottom: 4 },
  receiptActionButton: { minHeight: 46, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadows.soft },
  receiptActionButtonText: { color: colors.bg, fontSize: 14, fontWeight: '900' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 10 }, formCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 14, ...shadows.card }, fieldLabel: { color: colors.mutedSoft, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  fuelSelector: { flexDirection: 'row', gap: 7, marginBottom: 17 }, fuelOption: { flex: 1, minHeight: 40, borderRadius: 7, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }, fuelOptionActive: { borderColor: colors.accent, backgroundColor: colors.accent }, fuelOptionText: { color: colors.mutedSoft, fontSize: 12, fontWeight: '800' }, fuelOptionTextActive: { color: colors.bg },
  cityButton: { height: 48, backgroundColor: colors.bgSoft, borderRadius: 7, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 }, cityButtonStart: { flexDirection: 'row', alignItems: 'center', gap: 8 }, cityButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 10 }, inputGroup: { flex: 1 }, inputShell: { minHeight: 47, borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSoft, paddingLeft: 11, paddingRight: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 17 }, input: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700', paddingVertical: 9 }, unit: { color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  saveButton: { minHeight: 46, borderRadius: 8, marginTop: 12, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, saveButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  expenseHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  expenseTitleGroup: { flex: 1, paddingRight: 10 },
  expenseTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  expenseSubtitle: { color: colors.mutedSoft, fontSize: 12, fontWeight: '600', marginTop: 3 },
  monthTotal: { alignItems: 'flex-end', backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  monthTotalLabel: { color: colors.mutedSoft, fontSize: 10, fontWeight: '700' },
  monthTotalValue: { color: colors.accent, fontSize: 13, fontWeight: '900', marginTop: 1 },
  expenseChartCard: { backgroundColor: colors.surface, borderColor: colors.borderLight, borderRadius: 12, borderWidth: 1.5, padding: 16, ...shadows.soft },
  expenseChartTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  expenseChartTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  expenseChartTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  expenseChartSubText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  barChart: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  barColumn: { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  barTrack: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 6, height: 100, justifyContent: 'flex-end', overflow: 'hidden', width: 16 },
  barFill: { backgroundColor: colors.accent, borderRadius: 6, minHeight: 0, width: '100%' },
  barLabel: { color: colors.mutedSoft, fontSize: 11, fontWeight: '700', marginTop: 8, textTransform: 'capitalize' },
  barValue: { color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 3 },
  historyTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  historyCount: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  historyCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, ...shadows.soft },
  emptyHistory: { alignItems: 'center', minHeight: 104, justifyContent: 'center', paddingHorizontal: 24 },
  emptyHistoryText: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 8, textAlign: 'center' },
  historyRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', minHeight: 68, paddingVertical: 10 },
  historyRowFirst: { borderTopWidth: 0 },
  historyIcon: { alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: 8, height: 36, justifyContent: 'center', marginRight: 10, width: 36 },
  historyCopy: { flex: 1, paddingRight: 7 }, historyTitle: { color: colors.text, fontSize: 13, fontWeight: '800' }, historyMeta: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 3 }, historyNotes: { color: colors.accent, fontSize: 10, fontWeight: '600', fontStyle: 'italic', marginTop: 2 },
  historyEnd: { alignItems: 'flex-end' }, historyAmountValue: { color: colors.text, fontSize: 13, fontWeight: '900' }, deleteButton: { padding: 4, marginTop: 4 },
  stationChipsContainer: { flexDirection: 'row', gap: 8, paddingBottom: 12, paddingTop: 4 },
  stationChip: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stationChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  stationChipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  stationChipTextActive: { color: colors.bg },
  calcBadge: { backgroundColor: colors.bgSoft, borderRadius: 6, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14 },
  calcBadgeText: { color: colors.mutedSoft, fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' }, modalSheet: { maxHeight: '88%', backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, modalTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 }, modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, closeButton: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, searchShell: { height: 46, borderRadius: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 }, searchInput: { flex: 1, color: colors.text, fontSize: 14, marginLeft: 8, paddingVertical: 8 }, cityOption: { minHeight: 53, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cityOptionName: { color: colors.text, fontSize: 14, fontWeight: '700' }, cityOptionEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 }, cityOptionPrice: { color: colors.mutedSoft, fontSize: 12, fontWeight: '700' },
  resultBackdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', paddingHorizontal: 24 }, resultSheet: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadows.card }, resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, resultTitle: { color: colors.text, fontSize: 18, fontWeight: '800' }, resultSubtitle: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 3 }, primaryResult: { backgroundColor: colors.accentSoft, borderRadius: 8, borderWidth: 1, borderColor: colors.accent, padding: 14, marginTop: 18 }, primaryResultLabel: { color: colors.mutedSoft, fontSize: 12, fontWeight: '700' }, primaryResultValue: { color: colors.accent, fontSize: 28, fontWeight: '800', marginTop: 4 }, resultRows: { marginTop: 10 }, resultRow: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, resultRowStart: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }, resultRowLabel: { color: colors.mutedSoft, fontSize: 12, fontWeight: '700' }, resultRowValue: { color: colors.text, fontSize: 13, fontWeight: '800', marginLeft: 8 }, resultCloseAction: { height: 44, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, resultCloseActionText: { color: colors.bg, fontSize: 14, fontWeight: '800' },
})

