import assert from 'node:assert/strict'
import {
  computeTabPillTranslateX,
  mergeTabBarContentFrame,
} from '../src/utils/tabPillLayout.js'

const pillWidth = 52

assert.deepEqual(mergeTabBarContentFrame({ x: 10, width: 80 }, { x: 14, width: 40 }), {
  x: 24,
  width: 40,
})

assert.equal(mergeTabBarContentFrame(null, { x: 0, width: 40 }), null)
assert.equal(mergeTabBarContentFrame({ x: 0, width: 0 }, { x: 0, width: 40 }), null)

assert.equal(computeTabPillTranslateX({ x: 24, width: 40 }, pillWidth), 18)
assert.equal(computeTabPillTranslateX({ x: 0, width: 52 }, pillWidth), 0)
assert.equal(computeTabPillTranslateX(null, pillWidth), null)

console.log('tab-pill-layout tests passed')
