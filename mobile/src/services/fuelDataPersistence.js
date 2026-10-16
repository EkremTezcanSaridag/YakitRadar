export const FUEL_DATA_CACHE_KEY = '@yakit-radar/fuel-data/v1'
export const FUEL_DATA_CACHE_VERSION = 1

export function buildPersistedFuelDataEntry(remotePayload, savedAtIso) {
  return {
    version: FUEL_DATA_CACHE_VERSION,
    savedAt: savedAtIso,
    payload: remotePayload,
  }
}

export function parsePersistedFuelDataEntry(raw) {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, reason: 'missing' }
  }

  try {
    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, reason: 'invalid_shape' }
    }

    if (parsed.version !== FUEL_DATA_CACHE_VERSION) {
      return { ok: false, reason: 'version_mismatch' }
    }

    if (!parsed.savedAt || typeof parsed.savedAt !== 'string') {
      return { ok: false, reason: 'missing_saved_at' }
    }

    if (!parsed.payload || typeof parsed.payload !== 'object') {
      return { ok: false, reason: 'missing_payload' }
    }

    const prices = parsed.payload.prices
    if (!Array.isArray(prices) || prices.length === 0) {
      return { ok: false, reason: 'empty_prices' }
    }

    return {
      ok: true,
      savedAt: parsed.savedAt,
      payload: parsed.payload,
    }
  } catch {
    return { ok: false, reason: 'json_parse_error' }
  }
}

export function formatCacheSavedAtLabel(isoValue) {
  if (!isoValue) {
    return null
  }

  const date = new Date(isoValue)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
