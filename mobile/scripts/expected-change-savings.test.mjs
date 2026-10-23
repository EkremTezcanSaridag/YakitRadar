import assert from 'node:assert/strict'
import {
  attachTankSavingsToBoxes,
  buildExpectedChangeSavingsLine,
  DEFAULT_TANK_CAPACITY_L,
} from '../src/services/expectedChangeSavings.js'

const decrease = buildExpectedChangeSavingsLine({
  tankLiters: '',
  direction: 'decrease',
  amountTlPerLiter: 2,
})
assert.ok(decrease)
assert.match(decrease.body, new RegExp(`^${DEFAULT_TANK_CAPACITY_L} litrelik depoya göre`))
assert.match(decrease.body, /100 TL kazanırsın/)
assert.equal(decrease.linkLabel, 'Aracım')

const increase = buildExpectedChangeSavingsLine({
  tankLiters: '42',
  direction: 'increase',
  amountTlPerLiter: 1.5,
})
assert.match(increase.body, /42 litrelik depoya göre/)
assert.match(increase.body, /63 TL tasarruf/)

assert.equal(
  buildExpectedChangeSavingsLine({
    tankLiters: 50,
    direction: 'decrease',
    amountTlPerLiter: null,
  }),
  null,
)

const boxes = attachTankSavingsToBoxes(
  [
    {
      fuelKey: 'motorin',
      direction: 'increase',
      amountTl: 2,
    },
  ],
  '40',
)
assert.ok(boxes[0].savingsLine)
assert.match(boxes[0].savingsLine.body, /80 TL tasarruf/)

console.log('expected-change-savings tests passed')
