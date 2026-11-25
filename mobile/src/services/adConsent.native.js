import {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  AdsConsentStatus,
} from 'react-native-google-mobile-ads'
import { logError } from '../utils/logger'

export async function prepareAdsConsent() {
  try {
    await AdsConsent.gatherConsent()
    const consentInfo = await AdsConsent.getConsentInfo()
    const canShowPrivacyOptions =
      consentInfo.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED

    if (!consentInfo.canRequestAds) {
      return { canRequestAds: false, requestNonPersonalizedAdsOnly: true, canShowPrivacyOptions }
    }

    if (consentInfo.status === AdsConsentStatus.NOT_REQUIRED) {
      return {
        canRequestAds: true,
        requestNonPersonalizedAdsOnly: false,
        canShowPrivacyOptions,
      }
    }

    const choices = await AdsConsent.getUserChoices()
    const requestNonPersonalizedAdsOnly = !choices.createAPersonalisedAdsProfile

    return {
      canRequestAds: true,
      requestNonPersonalizedAdsOnly,
      canShowPrivacyOptions,
    }
  } catch (error) {
    logError('ads.consent', error)
    return { canRequestAds: false, requestNonPersonalizedAdsOnly: true, canShowPrivacyOptions: false }
  }
}

export async function showPrivacyOptionsForm() {
  try {
    await AdsConsent.showPrivacyOptionsForm()
    return true
  } catch (error) {
    logError('ads.privacyOptions', error)
    return false
  }
}
