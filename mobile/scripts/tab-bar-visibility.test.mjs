import assert from 'node:assert/strict'
import { isTabBarRouteHidden } from '../src/utils/tabBarVisibility.js'

assert.equal(isTabBarRouteHidden(undefined), false)
assert.equal(isTabBarRouteHidden({}), false)
assert.equal(isTabBarRouteHidden({ tabBarButton: null }), true)
assert.equal(isTabBarRouteHidden({ tabBarItemStyle: { display: 'none' } }), true)
assert.equal(isTabBarRouteHidden({ tabBarItemStyle: { display: 'flex' } }), false)
assert.equal(
  isTabBarRouteHidden({ tabBarItemStyle: [{ display: 'flex' }, { display: 'none' }] }),
  true,
)

console.log('tab-bar-visibility tests passed')
