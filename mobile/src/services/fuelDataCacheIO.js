import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  buildPersistedFuelDataEntry,
  FUEL_DATA_CACHE_KEY,
  parsePersistedFuelDataEntry,
} from './fuelDataPersistence'

export async function readFuelDataCache() {
  try {
    const raw = await AsyncStorage.getItem(FUEL_DATA_CACHE_KEY)
    const parsed = parsePersistedFuelDataEntry(raw)

    if (!parsed.ok) {
      return null
    }

    return {
      payload: parsed.payload,
      savedAt: parsed.savedAt,
    }
  } catch {
    return null
  }
}

export async function writeFuelDataCache(remotePayload) {
  const savedAt = new Date().toISOString()

  try {
    await AsyncStorage.setItem(
      FUEL_DATA_CACHE_KEY,
      JSON.stringify(buildPersistedFuelDataEntry(remotePayload, savedAt)),
    )
    return savedAt
  } catch {
    return null
  }
}
