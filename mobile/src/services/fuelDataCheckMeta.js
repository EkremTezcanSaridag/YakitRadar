export const DATA_CHECK_STALE_MS = 6 * 60 * 60 * 1000

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
