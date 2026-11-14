/**
 * Public URLs configured at build time (EAS / .env).
 * Values must not be committed; only variable names are documented.
 */
export function getPrivacyPolicyUrl() {
  const url = String(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '').trim()
  return url.length > 0 ? url : null
}
