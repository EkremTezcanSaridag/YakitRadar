import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from '../theme'

const storageKey = '@yakit-radar/vehicle-profile'
const expenseHistoryStorageKey = '@yakit-radar/vehicle-expense-history'
const maxExpenseHistoryRecords = 200

export const defaultVehicleProfile = {
  city: 'İstanbul',
  fuelKey: 'benzin95',
  spentAmount: '500',
  distanceKm: '300',
  tankCapacityL: '',
}

export async function loadVehicleProfile() {
  try {
    const storedProfile = await AsyncStorage.getItem(storageKey)
    return storedProfile ? { ...defaultVehicleProfile, ...JSON.parse(storedProfile) } : defaultVehicleProfile
  } catch {
    return defaultVehicleProfile
  }
}

export function saveVehicleProfile(profile) {
  return AsyncStorage.setItem(storageKey, JSON.stringify(profile))
}

export async function loadVehicleExpenseHistory() {
  try {
    const storedHistory = await AsyncStorage.getItem(expenseHistoryStorageKey)
    const parsedHistory = storedHistory ? JSON.parse(storedHistory) : []
    return Array.isArray(parsedHistory) ? parsedHistory : []
  } catch {
    return []
  }
}

export const fuelStations = [
  { id: 'shell', name: 'Shell', icon: 'gas-station', color: colors.stationShell },
  { id: 'opet', name: 'Opet', icon: 'gas-station', color: colors.stationBrandOpet },
  { id: 'po', name: 'Petrol Ofisi', icon: 'gas-station', color: colors.stationBrandPetrolOfisi },
  { id: 'aytemiz', name: 'Aytemiz', icon: 'gas-station', color: colors.stationBrandAytemiz },
  { id: 'total', name: 'TotalEnergies', icon: 'gas-station', color: colors.stationBrandTotal },
  { id: 'tp', name: 'TP', icon: 'gas-station', color: colors.stationBrandTp },
  { id: 'sunpet', name: 'Sunpet', icon: 'gas-station', color: colors.stationBrandSunpet },
  { id: 'diger', name: 'Diğer İstasyon', icon: 'gas-station', color: colors.stationBrandOther },
]

export async function addVehicleExpenseRecord(record) {
  const history = await loadVehicleExpenseHistory()
  const nextRecord = {
    station: 'Shell',
    notes: '',
    paymentMethod: 'Kredi Kartı',
    ...record,
    createdAt: record.receiptDate ? new Date(record.receiptDate).toISOString() : new Date().toISOString(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
  const nextHistory = [nextRecord, ...history].slice(0, maxExpenseHistoryRecords)

  await AsyncStorage.setItem(expenseHistoryStorageKey, JSON.stringify(nextHistory))
  return nextHistory
}

export async function deleteVehicleExpenseRecord(id) {
  const history = await loadVehicleExpenseHistory()
  const nextHistory = history.filter((item) => item.id !== id)

  await AsyncStorage.setItem(expenseHistoryStorageKey, JSON.stringify(nextHistory))
  return nextHistory
}
