import assert from 'node:assert/strict'
import {
  buildDirectionSubtitle,
  filterVisibleExpectedFuelSignals,
  isAfterBuGeceEffectiveMidnight,
  parseExpectedFuelSignals,
  shouldShowExpectedChangeBox,
} from '../src/services/expectedChangeLogic.js'

const cityRow = { benzin95: 50.0, motorin: 55.0, lpg: 30.0 }

const baseSignals = [
  {
    fuel: 'Motorin',
    direction: 'increase',
    expected_amount_tl: 2.0,
    current_price: 55.0,
    expected_price: 57.0,
    timing: 'Bu gece yarısı',
    effective_at: '2026-10-10T00:00:00+03:00',
  },
]

assert.deepEqual(parseExpectedFuelSignals([{ fuel: 'Motorin', direction: 'increase', expected_amount: 2 }]), [])
assert.deepEqual(parseExpectedFuelSignals([{ fuel: 'Motorin', direction: 'increase', expected_amount_tl: 0 }]), [])

const parsed = parseExpectedFuelSignals(baseSignals)
assert.equal(parsed.length, 1)
assert.equal(parsed[0].amountTl, 2)

const beforeMidnight = Date.parse('2026-10-09T22:00:00+03:00')
assert.equal(isAfterBuGeceEffectiveMidnight('2026-10-10T00:00:00+03:00', beforeMidnight), false)
assert.equal(
  buildDirectionSubtitle('increase', 'Bu gece yarısı', { pendingPumpReflection: false }),
  'Zam · bu gece',
)

const afterMidnight = Date.parse('2026-10-10T01:00:00+03:00')
assert.equal(isAfterBuGeceEffectiveMidnight('2026-10-10T00:00:00+03:00', afterMidnight), true)
assert.equal(
  buildDirectionSubtitle('increase', 'Bu gece yarısı', { pendingPumpReflection: true }),
  'Zam · Pompaya yansıması bekleniyor',
)

const change = parsed[0]
assert.equal(
  shouldShowExpectedChangeBox(change, { motorin: 56.9 }, afterMidnight),
  false,
  'hide when pump price within tolerance',
)
assert.equal(
  shouldShowExpectedChangeBox(change, { motorin: 54.0 }, afterMidnight),
  true,
  'show when pump not caught up',
)

const stale = Date.parse('2026-10-10T13:00:00+03:00')
assert.equal(
  shouldShowExpectedChangeBox(change, { motorin: 54.0 }, stale),
  false,
  'hide after 12h past effective midnight',
)

const visible = filterVisibleExpectedFuelSignals(baseSignals, { motorin: 54.0 }, afterMidnight)
assert.equal(visible.length, 1)

console.log('expected-change tests passed')
