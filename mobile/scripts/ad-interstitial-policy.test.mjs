import assert from 'node:assert/strict'
import {
  createInterstitialPolicyState,
  markInterstitialShown,
  MIN_MS_BETWEEN_INTERSTITIALS,
  MIN_TAB_TRANSITIONS_BEFORE_AD,
  recordTabTransition,
  shouldOfferInterstitial,
} from '../src/services/adInterstitialPolicy.js'
import { hasProductionInterstitialConfig, resolveInterstitialUnitId } from '../src/services/adUnitIdLogic.js'

let state = createInterstitialPolicyState(0)

for (let index = 0; index < MIN_TAB_TRANSITIONS_BEFORE_AD - 1; index += 1) {
  state = recordTabTransition(state)
  assert.equal(shouldOfferInterstitial(state, 1000), false)
}

state = recordTabTransition(state)
assert.equal(shouldOfferInterstitial(state, 1000), true)

state = markInterstitialShown(state, 5000)

for (let index = 0; index < MIN_TAB_TRANSITIONS_BEFORE_AD; index += 1) {
  state = recordTabTransition(state)
}

assert.equal(shouldOfferInterstitial(state, 5000 + MIN_MS_BETWEEN_INTERSTITIALS - 1), false)
assert.equal(shouldOfferInterstitial(state, 5000 + MIN_MS_BETWEEN_INTERSTITIALS), true)

assert.equal(resolveInterstitialUnitId({ platform: 'android', devMode: true, androidUnitId: '', iosUnitId: '' }), 'dev-test-interstitial')
assert.equal(
  resolveInterstitialUnitId({ platform: 'android', devMode: false, androidUnitId: 'unit-android', iosUnitId: '' }),
  'unit-android',
)
assert.equal(resolveInterstitialUnitId({ platform: 'android', devMode: false, androidUnitId: '', iosUnitId: '' }), null)
assert.equal(hasProductionInterstitialConfig({ androidUnitId: 'x', iosUnitId: '' }), true)

console.log('ad-interstitial-policy tests passed')
