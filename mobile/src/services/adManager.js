import {
  createInterstitialPolicyState,
  markInterstitialShown,
  MIN_TAB_TRANSITIONS_BEFORE_AD,
  recordTabTransition,
  shouldOfferInterstitial,
} from './adInterstitialPolicy'

export const AD_INTERACTION_THRESHOLD = MIN_TAB_TRANSITIONS_BEFORE_AD

let policyState = createInterstitialPolicyState()

export async function initAds() {}

export function loadNextInterstitial() {}

export function trackAdInteraction() {
  policyState = recordTabTransition(policyState)

  if (!shouldOfferInterstitial(policyState)) {
    return false
  }

  showInterstitialAd()
  policyState = markInterstitialShown(policyState)
  return true
}

export function showInterstitialAd() {
  if (__DEV__) {
    console.log('[AdManager] Interstitial eşiği karşılandı (native derlemede gösterilir).')
  }
}

export function getAdClickCount() {
  return policyState.tabTransitions
}

export function resetAdClickCount() {
  policyState = createInterstitialPolicyState()
}
