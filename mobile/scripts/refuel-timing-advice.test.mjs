import assert from 'node:assert/strict'
import {
  buildRefuelSavingsLine,
  buildRefuelTimingAdvice,
  computePredictionAccuracy,
} from '../src/services/refuelTimingAdvice.js'

const history = [
  { date: '2026-10-20', benzinChange: -2.5, motorinChange: -2.0, lpgChange: -0.5 },
  { date: '2026-10-19', benzinChange: 1.2, motorinChange: 1.0, lpgChange: 0.3 },
  { date: '2026-10-18', benzinChange: -1.0, motorinChange: -0.8, lpgChange: -0.2 },
  { date: '2026-10-17', benzinChange: 0.5, motorinChange: 0.4, lpgChange: 0.1 },
]

const marketSignalHistory = [
  {
    signalDate: '2026-10-20',
    direction: 'decrease',
    confidence: 'medium',
    signals: [{ fuel: 'Benzin', direction: 'decrease', confidence: 'medium' }],
  },
  {
    signalDate: '2026-10-19',
    direction: 'increase',
    confidence: 'medium',
    signals: [{ fuel: 'Benzin', direction: 'increase', confidence: 'medium' }],
  },
  {
    signalDate: '2026-10-18',
    direction: 'decrease',
    confidence: 'high',
    signals: [{ fuel: 'Benzin', direction: 'decrease', confidence: 'high' }],
  },
]

const accuracy = computePredictionAccuracy(marketSignalHistory, history, 'benzin95')
assert.equal(accuracy.evaluated, 3)
assert.equal(accuracy.percent, 100)

const advice = buildRefuelTimingAdvice({
  marketSignal: {
    direction: 'decrease',
    confidence: 'high',
    confidenceLabel: 'Yüksek',
    signals: [{ fuel: 'Benzin', direction: 'decrease', confidence: 'high', expected_amount_tl: 1.5 }],
  },
  marketSignalHistory,
  history,
  fuelKey: 'benzin95',
})

assert.equal(advice.action, 'wait')

const savingsDecrease = buildRefuelSavingsLine({
  tankLiters: '50',
  direction: 'decrease',
  amountTlPerLiter: 1.5,
})
assert.equal(savingsDecrease.kind, 'amount')
assert.match(savingsDecrease.text, /75 TL kazanırsın/)

const savingsIncrease = buildRefuelSavingsLine({
  tankLiters: 40,
  direction: 'increase',
  amountTlPerLiter: 2,
})
assert.match(savingsIncrease.text, /80 TL tasarruf/)

const savingsNoTank = buildRefuelSavingsLine({
  tankLiters: '',
  direction: 'decrease',
  amountTlPerLiter: 1,
})
assert.equal(savingsNoTank.kind, 'missing_tank')

const savingsNoAmount = buildRefuelSavingsLine({
  tankLiters: 50,
  direction: 'decrease',
  amountTlPerLiter: null,
})
assert.equal(savingsNoAmount.kind, 'fallback')

const adviceWithTank = buildRefuelTimingAdvice({
  marketSignal: {
    direction: 'decrease',
    confidence: 'high',
    signals: [{ fuel: 'Benzin', direction: 'decrease', expected_amount_tl: 1.5 }],
  },
  marketSignalHistory,
  history,
  fuelKey: 'benzin95',
  tankLiters: '50',
})
assert.ok(adviceWithTank.savingsLine?.text.includes('kazanırsın'))

console.log('refuel-timing-advice tests passed')
