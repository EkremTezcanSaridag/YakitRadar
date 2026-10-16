import assert from 'node:assert/strict'
import {
  buildPersistedFuelDataEntry,
  FUEL_DATA_CACHE_VERSION,
  formatCacheSavedAtLabel,
  parsePersistedFuelDataEntry,
} from '../src/services/fuelDataPersistence.js'
import {
  resolveFuelEmptyState,
  resolveStatusBanner,
} from '../src/services/fuelDataViewState.js'
import { withTimeout } from '../src/utils/withTimeout.js'

const payload = {
  prices: [{ il: 'Ankara', benzin_95: 50, motorin: 51, lpg: 30, guncelleme: '2026-10-16' }],
  history: [],
  marketSignal: null,
  priceChangeEvents: [],
  source: 'supabase',
}

const entry = buildPersistedFuelDataEntry(payload, '2026-10-16T10:00:00+03:00')
const serialized = JSON.stringify(entry)
const parsed = parsePersistedFuelDataEntry(serialized)

assert.equal(parsed.ok, true)
assert.equal(parsed.savedAt, entry.savedAt)
assert.deepEqual(parsed.payload.prices, payload.prices)

assert.equal(parsePersistedFuelDataEntry('{not json').ok, false)
assert.equal(parsePersistedFuelDataEntry(JSON.stringify({ version: 99, savedAt: 'x', payload })).ok, false)
assert.equal(
  parsePersistedFuelDataEntry(JSON.stringify({ version: FUEL_DATA_CACHE_VERSION, savedAt: 'x', payload: { prices: [] } })).ok,
  false,
)

const cachedFuelData = {
  hasRealPrices: true,
  networkFetchFailed: true,
  cacheSavedAt: '2026-10-16T10:00:00+03:00',
  dataCheckStale: true,
}

const offlineBanner = resolveStatusBanner({ isOffline: true, fuelData: cachedFuelData })
assert.equal(offlineBanner?.variant, 'offline')
assert.match(offlineBanner.text, /İnternet yok/)

const staleBanner = resolveStatusBanner({
  isOffline: false,
  fuelData: { hasRealPrices: true, dataCheckStale: true, lastUpdatedHm: '14:30' },
})
assert.equal(staleBanner?.variant, 'stale')

assert.equal(resolveFuelEmptyState({ loading: true, fuelData: {}, isOffline: false }), null)
assert.equal(resolveFuelEmptyState({ loading: false, fuelData: { hasRealPrices: true }, isOffline: false }), null)

const offlineEmpty = resolveFuelEmptyState({ loading: false, fuelData: {}, isOffline: true })
assert.equal(offlineEmpty.variant, 'offline')

const errorEmpty = resolveFuelEmptyState({
  loading: false,
  fuelData: { error: new Error('x') },
  isOffline: false,
})
assert.equal(errorEmpty.variant, 'error')

assert.equal(formatCacheSavedAtLabel('2026-10-16T10:00:00+03:00')?.includes(':'), true)
assert.equal(formatCacheSavedAtLabel('invalid'), null)

let timedOut = false
try {
  await withTimeout(new Promise(() => {}), 20)
} catch (error) {
  timedOut = error?.message === 'request_timeout'
}
assert.equal(timedOut, true)

console.log('fuel-data-offline tests passed')
