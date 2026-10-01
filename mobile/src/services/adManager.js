// Web ve genel fallback ortamı için AdManager mock/simülasyon servisi
export const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'
export const AD_INTERACTION_THRESHOLD = 8

let clickCounter = 0

export async function initAds() {
  // Web / simülasyon ortamında native AdMob çalışmaz
}

export function loadNextInterstitial() {
  // Web / simülasyon ortamında boş işlem
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
  if (__DEV__) {
    console.log('[AdManager] 8 tıklamaya ulaşıldı - Android APK derlemesinde tam ekran geçiş reklamı açılacaktır.')
  }
}

export function getAdClickCount() {
  return clickCounter
}

export function resetAdClickCount() {
  clickCounter = 0
}
