export const DATA_CHECK_STALE_MS = 6 * 60 * 60 * 1000
export const SOURCE_STALE_MS = 24 * 60 * 60 * 1000

const SOURCE_TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/

export function formatHmEuropeIstanbul(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function buildSonKontrolMeta(syncedAt) {
  const checkedAt = syncedAt instanceof Date ? syncedAt : new Date(syncedAt)

  return {
    dataCheckStale: Date.now() - checkedAt.getTime() > DATA_CHECK_STALE_MS,
    lastUpdatedHm: formatHmEuropeIstanbul(checkedAt),
    lastUpdatedLabel: 'Son kontrol',
  }
}

/**
 * Parse the Supabase `guncelleme` column ("2026-11-12 08:05", Istanbul time)
 * and ISO timestamps coming from the API/cache.
 */
export function parseSourceUpdatedAt(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const text = String(value).trim()

  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const zoned = new Date(text)
    return Number.isNaN(zoned.getTime()) ? null : zoned
  }

  const match = text.match(SOURCE_TIMESTAMP_RE)

  if (match) {
    const [, year, month, day, hour = '00', minute = '00'] = match
    const instant = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+03:00`)
    return Number.isNaN(instant.getTime()) ? null : instant
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatSourceUpdatedLabel(value) {
  const date = value instanceof Date ? value : parseSourceUpdatedAt(value)

  if (!date) {
    return null
  }

  const formatted = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  return formatted.replace(',', '')
}

function newestSourceInstant(prices) {
  const rows = Array.isArray(prices) ? prices : []
  let newest = null

  for (const row of rows) {
    const parsed = parseSourceUpdatedAt(row?.dataUpdatedAt ?? row?.guncelleme ?? row?.updatedAt)

    if (parsed && (!newest || parsed.getTime() > newest.getTime())) {
      newest = parsed
    }
  }

  return newest
}

/**
 * Freshness of the price data itself (source `guncelleme`), independent of
 * when the device last synced. Data older than 24 hours is treated as stale.
 */
export function buildSourceFreshness(prices, now = Date.now()) {
  const newest = newestSourceInstant(prices)

  if (!newest) {
    return {
      sourceUpdatedAtIso: null,
      sourceUpdatedLabel: null,
      sourceAgeMs: null,
      sourceStale: false,
    }
  }

  const ageMs = Math.max(0, now - newest.getTime())

  return {
    sourceUpdatedAtIso: newest.toISOString(),
    sourceUpdatedLabel: formatSourceUpdatedLabel(newest),
    sourceAgeMs: ageMs,
    sourceStale: ageMs > SOURCE_STALE_MS,
  }
}

export function snapshotFuelPricesForCompare(prices) {
  const rows = Array.isArray(prices) ? prices.filter((row) => row?.il) : []

  return rows
    .map(
      (row) =>
        `${row.il}|${row.benzin_95 ?? ''}|${row.motorin ?? ''}|${row.lpg ?? ''}|${row.guncelleme ?? row.dataUpdatedAt ?? ''}`,
    )
    .sort()
    .join(';')
}
