import AsyncStorage from '@react-native-async-storage/async-storage'

const SHOW_MARKET_NOTE_KEY = '@yakit-radar/show-market-note'
const NOTIFICATION_PROMPT_SEEN_KEY = '@yakit-radar/notification-permission-prompt-seen'

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

export async function loadNotificationPermissionPromptSeen() {
  try {
    return (await AsyncStorage.getItem(NOTIFICATION_PROMPT_SEEN_KEY)) === '1'
  } catch {
    // If storage is unavailable, prefer not to nag the user on every launch.
    return true
  }
}

export async function saveNotificationPermissionPromptSeen() {
  try {
    await AsyncStorage.setItem(NOTIFICATION_PROMPT_SEEN_KEY, '1')
  } catch {
    // ignore
  }
}
