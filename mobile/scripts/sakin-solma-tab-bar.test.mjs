import assert from 'node:assert/strict'
import {
  filterVisibleTabBarRoutes,
  isTabBarRouteHidden,
} from '../src/utils/tabBarVisibility.js'

const routes = [
  { key: 'r-home', name: 'Ana Sayfa' },
  { key: 'r-about', name: 'Hakkında' },
]

const descriptorsOk = {
  'r-home': {
    options: { title: 'Ana Sayfa' },
  },
  'r-about': {
    options: {
      title: 'Hakkında',
      tabBarButton: () => null,
      tabBarItemStyle: { display: 'none' },
    },
  },
}

const visible = filterVisibleTabBarRoutes(routes, descriptorsOk)
assert.deepEqual(
  visible.map((r) => r.name),
  ['Ana Sayfa'],
  'hidden Hakkında must not appear in visible tab list',
)

assert.equal(isTabBarRouteHidden(descriptorsOk['r-about'].options), true)

const descriptorsMissing = {
  'r-home': { options: {} },
}

const visibleMissing = filterVisibleTabBarRoutes(routes, descriptorsMissing)
assert.deepEqual(
  visibleMissing.map((r) => r.name),
  ['Ana Sayfa'],
  'missing descriptor route must be skipped, not thrown',
)

console.log('sakin-solma-tab-bar tests passed')
