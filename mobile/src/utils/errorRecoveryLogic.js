export function buildErrorDigest(error, devMode = false) {
  if (!error) {
    return 'unknown'
  }

  const name = error.name || 'Error'

  if (!devMode) {
    return name
  }

  const message = (error.message || '').slice(0, 120)
  const stackLine = (error.stack || '').split('\n')[1]?.trim() || ''

  return `${name}|${message}|${stackLine}`
}

export function shouldReloadAfterRecover(recoverAttempts) {
  return recoverAttempts >= 1
}
