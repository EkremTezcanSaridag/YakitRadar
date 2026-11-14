import assert from 'node:assert/strict'
import { getPrivacyPolicyUrl } from '../src/config/publicLinks.js'

const original = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL

try {
  delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL
  assert.equal(getPrivacyPolicyUrl(), null)

  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = '   '
  assert.equal(getPrivacyPolicyUrl(), null)

  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = '  https://example.com/privacy  '
  assert.equal(getPrivacyPolicyUrl(), 'https://example.com/privacy')
} finally {
  if (original === undefined) {
    delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL
  } else {
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = original
  }
}

console.log('privacy-links tests passed')
