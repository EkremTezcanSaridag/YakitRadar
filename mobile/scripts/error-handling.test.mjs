import assert from 'node:assert/strict'
import { buildErrorDigest, shouldReloadAfterRecover } from '../src/utils/errorRecoveryLogic.js'

const sampleError = new Error('boom')
sampleError.name = 'TestError'

assert.equal(buildErrorDigest(sampleError, false), 'TestError')
assert.match(buildErrorDigest(sampleError, true), /^TestError\|/)

assert.equal(shouldReloadAfterRecover(0), false)
assert.equal(shouldReloadAfterRecover(1), true)
assert.equal(shouldReloadAfterRecover(2), true)

console.log('error-handling tests passed')
