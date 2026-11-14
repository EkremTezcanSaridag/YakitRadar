import assert from 'node:assert/strict'
import { isDuplicateDriveCalculation } from '../src/utils/expenseRecordDedupe.js'

const base = {
  city: 'İstanbul',
  createdAt: '2026-11-14T09:15:00.000Z',
  distanceKm: 300,
  fuelKey: 'benzin95',
  spentAmount: 1500,
  station: 'Sürüş Hesabı',
}

assert.equal(
  isDuplicateDriveCalculation(base, { ...base, id: 'older' }),
  true,
  'same drive calculation on the same day must be treated as a duplicate',
)

assert.equal(
  isDuplicateDriveCalculation(base, { ...base, spentAmount: 1501 }),
  false,
  'different spent amount is a new record',
)

assert.equal(
  isDuplicateDriveCalculation(base, { ...base, distanceKm: 301 }),
  false,
  'different distance is a new record',
)

assert.equal(
  isDuplicateDriveCalculation(base, { ...base, city: 'Ankara' }),
  false,
  'different city is a new record',
)

assert.equal(
  isDuplicateDriveCalculation(base, { ...base, fuelKey: 'motorin' }),
  false,
  'different fuel is a new record',
)

assert.equal(
  isDuplicateDriveCalculation(base, { ...base, createdAt: '2026-11-13T09:15:00.000Z' }),
  false,
  'same calculation on another day is a new record',
)

assert.equal(
  isDuplicateDriveCalculation(base, { ...base, station: 'Shell' }),
  false,
  'receipt records must never be deduplicated',
)

assert.equal(
  isDuplicateDriveCalculation({ ...base, station: 'Shell' }, base),
  false,
  'candidate receipts must never be deduplicated',
)

assert.equal(
  isDuplicateDriveCalculation(base, { ...base, createdAt: 'not-a-date' }),
  false,
  'invalid dates must not collapse records',
)

assert.equal(
  isDuplicateDriveCalculation(base, { ...base, spentAmount: '1500,00' }),
  false,
  'non-numeric amount strings are treated as zero and not duplicated',
)

console.log('expense-record-dedupe tests passed')
