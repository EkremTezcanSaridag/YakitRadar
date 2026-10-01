import mobileAds, {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads'

export const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'
export const AD_INTERACTION_THRESHOLD = 8

let clickCounter = 0
let interstitialAd = null
let isAdLoaded = false
let isAdLoading = false

export async function initAds() {
  try {
    await mobileAds().initialize()
    loadNextInterstitial()
  } catch (error) {
    console.warn('[AdManager] AdMob başlatma uyarısı:', error?.message)
  }
}

export function loadNextInterstitial() {
  if (isAdLoading || isAdLoaded) {
    return
  }

  const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : TEST_INTERSTITIAL_ID

  try {
    isAdLoading = true
    interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    })

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      isAdLoaded = true
      isAdLoading = false
    })

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      isAdLoaded = false
      isAdLoading = false
      loadNextInterstitial()
    })

    interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
      isAdLoaded = false
      isAdLoading = false
    })

    interstitialAd.load()
  } catch (err) {
    isAdLoading = false
    isAdLoaded = false
  }
}

export function trackAdInteraction() {
  clickCounter += 1

  if (clickCounter >= AD_INTERACTION_THRESHOLD) {
    clickCounter = 0
    showInterstitialAd()
    return true
  }

  return false
}

export function showInterstitialAd() {
  if (interstitialAd && isAdLoaded) {
    try {
      interstitialAd.show()
      isAdLoaded = false
    } catch (error) {
      console.warn('[AdManager] Reklam gösterim hatası:', error?.message)
      loadNextInterstitial()
    }
  } else {
    loadNextInterstitial()
  }
}

export function getAdClickCount() {
  return clickCounter
}

export function resetAdClickCount() {
  clickCounter = 0
}
