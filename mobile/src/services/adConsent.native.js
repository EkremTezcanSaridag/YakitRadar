import { AdsConsent } from 'react-native-google-mobile-ads'
import { logError } from '../utils/logger'

export async function prepareAdsConsent() {
  try {
    await AdsConsent.gatherConsent()
    const consentInfo = await AdsConsent.getConsentInfo()

    if (!consentInfo.canRequestAds) {
      return { canRequestAds: false, requestNonPersonalizedAdsOnly: true }
    }

    const choices = await AdsConsent.getUserChoices()
    const requestNonPersonalizedAdsOnly = !choices.createAPersonalisedAdsProfile

    return {
      canRequestAds: true,
      requestNonPersonalizedAdsOnly,
    }
  } catch (error) {
    logError('ads.consent', error)
    return { canRequestAds: false, requestNonPersonalizedAdsOnly: true }
  }
}
