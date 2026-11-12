import assert from 'node:assert/strict'
import {
  SOURCE_STALE_MS,
  buildSourceFreshness,
  formatSourceUpdatedLabel,
  parseSourceUpdatedAt,
} from '../src/services/fuelDataCheckMeta.js'
import { resolveStatusBanner } from '../src/services/fuelDataViewState.js'

const now = new Date('2026-11-12T12:00:00+03:00').getTime()

assert.equal(SOURCE_STALE_MS, 24 * 60 * 60 * 1000)

const parsed = parseSourceUpdatedAt('2026-11-12 08:05')
assert.equal(parsed.toISOString(), '2026-11-12T05:05:00.000Z')
assert.equal(parseSourceUpdatedAt('2026-11-12T05:05:00.000Z').toISOString(), '2026-11-12T05:05:00.000Z')
assert.equal(parseSourceUpdatedAt(''), null)
assert.equal(parseSourceUpdatedAt('not-a-date'), null)

const label = formatSourceUpdatedLabel('2026-11-12 08:05')
assert.ok(label.includes('12'), `label should contain day: ${label}`)
assert.ok(label.includes('08:05'), `label should contain time: ${label}`)

const fresh = buildSourceFreshness(
  [
    { guncelleme: '2026-11-12 08:05' },
    { guncelleme: '2026-11-11 08:05' },
  ],
  now,
)
assert.equal(fresh.sourceStale, false)
assert.equal(fresh.sourceUpdatedAtIso, '2026-11-12T05:05:00.000Z')
assert.equal(fresh.sourceAgeMs, (3 * 60 + 55) * 60 * 1000)

const stale = buildSourceFreshness([{ guncelleme: '2026-11-10 08:05' }], now)
assert.equal(stale.sourceStale, true)
assert.ok(stale.sourceAgeMs > SOURCE_STALE_MS)

const boundary = buildSourceFreshness([{ guncelleme: '2026-11-11 12:00' }], now)
assert.equal(boundary.sourceStale, false)

const empty = buildSourceFreshness([], now)
assert.equal(empty.sourceStale, false)
assert.equal(empty.sourceUpdatedLabel, null)

const staleBanner = resolveStatusBanner({
  isOffline: false,
  fuelData: {
    hasRealPrices: true,
    dataCheckStale: false,
    sourceStale: true,
    sourceUpdatedLabel: stale.sourceUpdatedLabel,
  },
})
assert.equal(staleBanner?.variant, 'stale')
assert.match(staleBanner.text, /24 saatten eski/)
assert.ok(staleBanner.text.includes('2026'), staleBanner.text)
assert.equal(staleBanner.actionLabel, 'Yenile')

const offlineWins = resolveStatusBanner({
  isOffline: true,
  fuelData: { hasRealPrices: true, sourceStale: true, cacheSavedAt: '2026-11-12T09:00:00+03:00' },
})
assert.equal(offlineWins?.variant, 'offline')

const freshBanner = resolveStatusBanner({ isOffline: false, fuelData: fresh })
assert.equal(freshBanner, null)

assert.equal(
  resolveStatusBanner({
    isOffline: false,
    fuelData: { hasRealPrices: true, dataCheckStale: true, sourceStale: true },
  })?.text,
  'Fiyatlar 6 saatten uzun süredir kontrol edilmedi',
)

console.log('fuel-data-freshness tests passed')
