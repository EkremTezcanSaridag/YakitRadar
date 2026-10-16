export async function prepareAdsConsent() {
  return { canRequestAds: false, requestNonPersonalizedAdsOnly: true }
}
