import assert from 'node:assert/strict'
import { matchesSearch, normalizeSearch } from '../src/utils/turkishSearch.js'

assert.equal(normalizeSearch('İstanbul'), 'istanbul', 'dotted capital I must normalize to i')
assert.equal(normalizeSearch('IĞDIR'), 'igdir', 'dotless capital I must normalize to i')
assert.equal(normalizeSearch('Çorum'), 'corum', 'c with cedilla must normalize to c')
assert.equal(normalizeSearch('Şanlıurfa'), 'sanliurfa', 's with cedilla must normalize to s')
assert.equal(normalizeSearch('  Muğla  '), 'mugla', 'surrounding whitespace must be trimmed')
assert.equal(normalizeSearch(''), '', 'empty input stays empty')
assert.equal(normalizeSearch(undefined), '', 'non-string input returns empty string')
assert.equal(normalizeSearch(42), '', 'numbers are not searchable values')

assert.equal(matchesSearch('istan', 'İstanbul'), true, 'diacritic-insensitive partial match')
assert.equal(matchesSearch('  ANK  ', 'Ankara'), true, 'case-insensitive trimmed match')
assert.equal(matchesSearch('izmir', 'Ankara'), false, 'non-matching query is rejected')
assert.equal(matchesSearch('', 'Ankara'), true, 'empty query matches every city')
assert.equal(matchesSearch('   ', 'Ankara'), true, 'whitespace-only query matches every city')
assert.equal(matchesSearch('corum', 'Çorum'), true, 'query without diacritics matches city with diacritics')

console.log('turkish-search tests passed')
