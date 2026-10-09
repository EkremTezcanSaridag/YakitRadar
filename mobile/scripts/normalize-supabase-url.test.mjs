import assert from 'node:assert/strict'
import {
  normalizeSupabaseUrl,
  normalizeSupabaseUrlDetails,
} from '../src/utils/normalizeSupabaseUrl.js'

const origin = 'https://example.test'

assert.equal(normalizeSupabaseUrl(origin), origin)
assert.equal(normalizeSupabaseUrl(`${origin}/`), origin)
assert.equal(normalizeSupabaseUrl(`${origin}/rest/v1`), origin)
assert.equal(normalizeSupabaseUrl(`${origin}/rest/v1/`), origin)
assert.equal(normalizeSupabaseUrl(`${origin}/REST/V1/`), origin)
assert.equal(normalizeSupabaseUrl(`  ${origin}/rest/v1  `), origin)
assert.equal(normalizeSupabaseUrl(`${origin}/rest/v1/rest/v1/`), origin)
assert.equal(normalizeSupabaseUrl(`${origin}//rest/v1/`), origin)

const details = normalizeSupabaseUrlDetails(`${origin}/rest/v1/`)
assert.equal(details.url, origin)
assert.equal(details.wasNormalized, true)

const unchanged = normalizeSupabaseUrlDetails(origin)
assert.equal(unchanged.wasNormalized, false)

assert.equal(normalizeSupabaseUrl(''), '')
assert.equal(normalizeSupabaseUrl('   '), '')

console.log('normalize-supabase-url tests passed')
