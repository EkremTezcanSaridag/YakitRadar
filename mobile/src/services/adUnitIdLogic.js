export function resolveInterstitialUnitId({ platform, devMode, androidUnitId, iosUnitId }) {
  if (devMode) {
    return 'dev-test-interstitial'
  }

  const configured = platform === 'ios' ? iosUnitId : androidUnitId
  const trimmed = configured?.trim()

  return trimmed || null
}

export function hasProductionInterstitialConfig({ androidUnitId, iosUnitId }) {
  return Boolean(androidUnitId?.trim() || iosUnitId?.trim())
}
