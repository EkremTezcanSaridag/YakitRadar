import assert from 'node:assert/strict'
import {
  buildPersistedFuelDataEntry,
  FUEL_DATA_CACHE_VERSION,
  formatCacheSavedAtLabel,
  parsePersistedFuelDataEntry,
  shouldShowFuelDataEmptyState,
  shouldShowOfflineBanner,
} from '../src/services/fuelDataPersistence.js'
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

const offlineData = {
  hasRealPrices: true,
  networkFetchFailed: true,
  cacheSavedAtLabel: '16 Eki 10:00',
}
assert.equal(shouldShowOfflineBanner(offlineData), true)
assert.equal(shouldShowOfflineBanner({ ...offlineData, networkFetchFailed: false }), false)

assert.equal(shouldShowFuelDataEmptyState({ hasRealPrices: false }, false), true)
assert.equal(shouldShowFuelDataEmptyState({ hasRealPrices: false }, true), false)
assert.equal(shouldShowFuelDataEmptyState({ hasRealPrices: true }, false), false)

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
