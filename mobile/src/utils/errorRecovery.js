import { DevSettings, Platform } from 'react-native'
import { logError } from './logger'
import { buildErrorDigest, shouldReloadAfterRecover } from './errorRecoveryLogic'

export { buildErrorDigest, shouldReloadAfterRecover }

export async function reloadApp() {
  try {
    const Updates = await import('expo-updates')
    if (typeof Updates.reloadAsync === 'function') {
      await Updates.reloadAsync()
      return true
    }
  } catch (error) {
    logError('reloadApp.updates', error)
  }

  if (__DEV__ && typeof DevSettings?.reload === 'function') {
    DevSettings.reload()
    return true
  }

  if (Platform.OS === 'web' && typeof globalThis.location?.reload === 'function') {
    globalThis.location.reload()
    return true
  }

  return false
}
