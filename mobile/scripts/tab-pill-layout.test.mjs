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
    const delta = tabPillAlignmentDelta(item, icon, fixture.borderWidth)

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

const sampleItem = { x: 8, y: 10, width: 69.6, height: 48 }
const sampleIcon = { y: 13, height: 22 }
assert.equal(computeTabPillTranslateX(sampleItem, 1)?.toFixed(1), '15.8')
assert.equal(computeTabPillTop(sampleItem, sampleIcon, 1)?.toFixed(1), '18.0')

console.log('tab-pill-layout tests passed')
