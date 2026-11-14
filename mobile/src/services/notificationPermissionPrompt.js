export function shouldShowNotificationPermissionPrompt({
  canAskAgain = true,
  granted = false,
  platform = 'android',
  seen = false,
} = {}) {
  if (platform === 'web') {
    return false
  }

  if (seen || granted) {
    return false
  }

  return canAskAgain !== false
}
