import assert from 'node:assert/strict'
import {
  ABOUT_DISCLAIMER_BODY,
  FUEL_PRICE_LEGAL_SHORT,
  FUEL_PRICE_SOURCE_LINE,
} from '../src/constants/legalCopy.js'

assert.ok(FUEL_PRICE_SOURCE_LINE.includes('tavsiye'))
assert.ok(FUEL_PRICE_LEGAL_SHORT.includes('resmi değildir'))
assert.ok(ABOUT_DISCLAIMER_BODY.length > 40)

console.log('legal-copy tests passed')
