import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appJsPath = join(__dirname, '../App.js')
const appJs = readFileSync(appJsPath, 'utf8')

assert.match(
  appJs,
  /<NetworkProvider>\s*\n\s*<FuelDataProvider>/,
  'FuelDataProvider must be a child of NetworkProvider (useReconnectEffect)',
)

assert.match(
  appJs,
  /<FuelDataProvider>\s*\n\s*<GestureHandlerRootView/,
  'FuelDataProvider must wrap GestureHandlerRootView so onboarding and tabs share one provider',
)

assert.match(appJs, /<AppRoot\s*\/>/, 'AppRoot expected under GestureHandlerRootView')

const mainTabsStart = appJs.indexOf('function MainTabs()')
const mainTabsEnd = appJs.indexOf('function AppRoot()', mainTabsStart)
assert.ok(mainTabsStart >= 0 && mainTabsEnd > mainTabsStart, 'could not slice MainTabs body')

const mainTabsBody = appJs.slice(mainTabsStart, mainTabsEnd)
assert.equal(
  mainTabsBody.includes('FuelDataProvider'),
  false,
  'MainTabs must not wrap Tab.Navigator in FuelDataProvider (avoid nested providers / double fetch)',
)

console.log('app-root-fuel-provider tests passed')
