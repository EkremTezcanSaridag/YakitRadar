import AsyncStorage from '@react-native-async-storage/async-storage'

const SHOW_MARKET_NOTE_KEY = '@yakit-radar/show-market-note'

export async function loadShowMarketNote() {
  try {
    const stored = await AsyncStorage.getItem(SHOW_MARKET_NOTE_KEY)
    if (stored === null) {
      return true
    }
    return stored === '1'
  } catch {
    return true
  }
}

export async function saveShowMarketNote(enabled) {
  try {
    await AsyncStorage.setItem(SHOW_MARKET_NOTE_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
  return enabled
}
