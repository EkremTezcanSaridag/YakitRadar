import assert from 'node:assert/strict'
import {
  clampChartTooltipLeft,
  formatHistoryChartTooltipDate,
  pickNearestChartPointIndex,
} from '../src/utils/chartNearestPoint.js'

const points = [{ x: 12 }, { x: 40 }, { x: 88 }, { x: 120 }]

assert.equal(pickNearestChartPointIndex(41, points), 1)
assert.equal(pickNearestChartPointIndex(10, points), 0)
assert.equal(pickNearestChartPointIndex(200, points), 3)
assert.equal(pickNearestChartPointIndex(50, []), -1)
assert.equal(pickNearestChartPointIndex(Number.NaN, points), -1)

assert.equal(formatHistoryChartTooltipDate('2026-10-12T12:00:00+03:00'), '12 Eki Pzt')

assert.equal(clampChartTooltipLeft(20, 100, 200, 8), 8)
assert.equal(clampChartTooltipLeft(180, 100, 200, 8), 92)
assert.equal(clampChartTooltipLeft(100, 100, 200, 8), 50)

console.log('chart-nearest-point tests passed')
