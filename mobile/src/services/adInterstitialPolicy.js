export const MIN_TAB_TRANSITIONS_BEFORE_AD = 20
export const MIN_MS_BETWEEN_INTERSTITIALS = 5 * 60 * 1000

export function createInterstitialPolicyState(nowMs = Date.now()) {
  return {
    tabTransitions: 0,
    lastShownAtMs: null,
    sessionStartedAtMs: nowMs,
  }
}

export function recordTabTransition(state) {
  return {
    ...state,
    tabTransitions: state.tabTransitions + 1,
  }
}

export function shouldOfferInterstitial(state, nowMs = Date.now()) {
  if (state.tabTransitions < MIN_TAB_TRANSITIONS_BEFORE_AD) {
    return false
  }

  if (state.lastShownAtMs == null) {
    return true
  }

  return nowMs - state.lastShownAtMs >= MIN_MS_BETWEEN_INTERSTITIALS
}

export function markInterstitialShown(state, nowMs = Date.now()) {
  return {
    ...state,
    tabTransitions: 0,
    lastShownAtMs: nowMs,
  }
}
