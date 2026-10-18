import assert from 'node:assert/strict'
import {
  buildTabBarFixture,
  computeTabPillTop,
  computeTabPillTranslateX,
  PILL_WIDTH,
  resolvePillWidth,
  tabPillAlignmentDelta,
} from '../src/utils/tabPillLayout.js'

const ALIGNMENT_TOLERANCE = 0.5

for (const screenWidth of [320, 360, 390, 412]) {
  const fixture = buildTabBarFixture(screenWidth)

  fixture.items.forEach((item, index) => {
    const icon = fixture.icons[index]
    const delta = tabPillAlignmentDelta(item, icon)

    assert.ok(delta, `missing delta for width ${screenWidth} tab ${index}`)
    assert.ok(
      delta.deltaX <= ALIGNMENT_TOLERANCE,
      `width ${screenWidth} tab ${index} deltaX ${delta.deltaX}`,
    )
    assert.ok(
      delta.deltaY <= ALIGNMENT_TOLERANCE,
      `width ${screenWidth} tab ${index} deltaY ${delta.deltaY}`,
    )
  })
}

assert.equal(resolvePillWidth(55), 51)
assert.equal(resolvePillWidth(56), PILL_WIDTH)

const sampleItem = { x: 0, y: 1, width: 64, height: 48 }
const sampleIcon = { x: 21, y: 5, height: 22, width: 22 }
assert.equal(computeTabPillTranslateX(sampleItem), 6)
assert.equal(computeTabPillTop(sampleItem, sampleIcon), 2)

const icon = { x: 21, y: 5, height: 22, width: 22 }
const rawItem = { x: 0, y: 1, width: 64, height: 48 }
const trueIconCenterX = rawItem.x + icon.x + icon.width / 2
const inflatedItem = { x: 8, y: 11, width: 64, height: 48 }
const inflatedPillCenterX =
  computeTabPillTranslateX(inflatedItem) + resolvePillWidth(inflatedItem.width) / 2
assert.ok(
  Math.abs(inflatedPillCenterX - trueIconCenterX) >= 7,
  'inflated item frame (old toSpecItemFrame) shifts pill ~8dp vs true icon center',
)

console.log('tab-pill-layout tests passed')
