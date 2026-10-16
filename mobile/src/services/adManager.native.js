import { Platform } from 'react-native'
import mobileAds, { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads'
import { prepareAdsConsent } from './adConsent'
import {
  createInterstitialPolicyState,
  markInterstitialShown,
  recordTabTransition,
  shouldOfferInterstitial,
} from './adInterstitialPolicy'
import { resolveInterstitialUnitId } from './adUnitIdLogic'
import { logError } from '../utils/logger'

export { MIN_TAB_TRANSITIONS_BEFORE_AD as AD_INTERACTION_THRESHOLD } from './adInterstitialPolicy'

let policyState = createInterstitialPolicyState()
let interstitialAd = null
let isAdLoaded = false
let isAdLoading = false
let adsEnabled = false
let requestNonPersonalizedAdsOnly = true

function resolveNativeInterstitialUnitId() {
  const logicalId = resolveInterstitialUnitId({
    platform: Platform.OS,
    devMode: __DEV__,
    androidUnitId: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID,
    iosUnitId: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS,
  })

  if (!logicalId) {
    return null
  }

  if (__DEV__) {
    return TestIds.INTERSTITIAL
  }

  return logicalId
}

export async function initAds() {
  const adUnitId = resolveNativeInterstitialUnitId()

  if (!adUnitId) {
    adsEnabled = false
    return
  }

  const consent = await prepareAdsConsent()

  if (!consent.canRequestAds) {
    adsEnabled = false
    return
  }

  requestNonPersonalizedAdsOnly = consent.requestNonPersonalizedAdsOnly

  try {
    await mobileAds().initialize()
    adsEnabled = true
    loadNextInterstitial(adUnitId)
  } catch (error) {
    adsEnabled = false
    logError('ads.init', error)
  }
}

export function loadNextInterstitial(adUnitId = resolveNativeInterstitialUnitId()) {
  if (!adsEnabled || !adUnitId || isAdLoading || isAdLoaded) {
    return
  }

  try {
    isAdLoading = true
    interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly,
    })

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      isAdLoaded = true
      isAdLoading = false
    })

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      isAdLoaded = false
      isAdLoading = false
      loadNextInterstitial(adUnitId)
    })

    interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
      isAdLoaded = false
      isAdLoading = false
    })

    interstitialAd.load()
  } catch (error) {
    isAdLoading = false
    isAdLoaded = false
    logError('ads.load', error)
  }
}

export function trackAdInteraction() {
  if (!adsEnabled) {
    return false
  }

  policyState = recordTabTransition(policyState)

  if (!shouldOfferInterstitial(policyState)) {
    return false
  }

  const shown = showInterstitialAd()

  if (shown) {
    policyState = markInterstitialShown(policyState)
  }

  return shown
}

export function showInterstitialAd() {
  if (!adsEnabled) {
    return false
  }

  if (interstitialAd && isAdLoaded) {
    try {
      interstitialAd.show()
      isAdLoaded = false
      return true
    } catch (error) {
      logError('ads.show', error)
      loadNextInterstitial()
      return false
    }
  }

  loadNextInterstitial()
  return false
}

export function getAdClickCount() {
  return policyState.tabTransitions
}

export function resetAdClickCount() {
  policyState = createInterstitialPolicyState()
}
