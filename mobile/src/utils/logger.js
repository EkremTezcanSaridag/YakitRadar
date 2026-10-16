function normalizeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || '',
    }
  }

  if (typeof error === 'string') {
    return { name: 'Error', message: error }
  }

  return { name: 'Error', message: 'unknown' }
}

/** Dev-only structured logging; production stays silent (future crash SDK hook). */
export function logError(scope, error) {
  if (!__DEV__) {
    return
  }

  const safeScope = String(scope || 'app').slice(0, 64)
  const { name, message } = normalizeError(error)
  const safeMessage = message.replace(/Bearer\s+\S+/gi, '[redacted]').slice(0, 300)

  console.error(`[${safeScope}] ${name}: ${safeMessage}`)
}
