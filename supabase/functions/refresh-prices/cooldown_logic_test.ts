import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

import {
  REFRESH_COOLDOWN_MS,
  shouldSkipWorkflowDispatch,
  TEST_NOTIFICATION_COOLDOWN_MS,
} from './cooldown_logic.ts'

const baseTime = Date.parse('2026-10-09T12:00:00.000Z')

Deno.test('does not skip when there are no recent runs', () => {
  const result = shouldSkipWorkflowDispatch([], baseTime)

  assertEquals(result, { skip: false })
})

Deno.test('skips when a run is in progress', () => {
  const result = shouldSkipWorkflowDispatch(
    [
      {
        status: 'in_progress',
        created_at: '2026-10-09T11:55:00.000Z',
        run_started_at: '2026-10-09T11:55:05.000Z',
      },
    ],
    baseTime,
  )

  assertEquals(result, { skip: true, reason: 'cooldown' })
})

Deno.test('skips when the latest completed run started within the cooldown window', () => {
  const result = shouldSkipWorkflowDispatch(
    [
      {
        status: 'completed',
        created_at: '2026-10-09T11:52:00.000Z',
        run_started_at: '2026-10-09T11:52:10.000Z',
      },
    ],
    baseTime,
  )

  assertEquals(result, { skip: true, reason: 'cooldown' })
})

Deno.test('allows dispatch when the latest run is outside the cooldown window', () => {
  const result = shouldSkipWorkflowDispatch(
    [
      {
        status: 'completed',
        created_at: '2026-10-09T11:40:00.000Z',
        run_started_at: '2026-10-09T11:40:10.000Z',
      },
    ],
    baseTime,
  )

  assertEquals(result, { skip: false })
})

Deno.test('uses created_at when run_started_at is missing', () => {
  const result = shouldSkipWorkflowDispatch(
    [
      {
        status: 'completed',
        created_at: '2026-10-09T11:59:30.000Z',
        run_started_at: null,
      },
    ],
    baseTime,
  )

  assertEquals(result, { skip: true, reason: 'cooldown' })
})

Deno.test('respects custom cooldown duration', () => {
  const result = shouldSkipWorkflowDispatch(
    [
      {
        status: 'completed',
        created_at: '2026-10-09T11:59:00.000Z',
        run_started_at: '2026-10-09T11:59:00.000Z',
      },
    ],
    baseTime,
    30_000,
  )

  assertEquals(result, { skip: false })
})

Deno.test('refresh cooldown window is ten minutes', () => {
  assertEquals(REFRESH_COOLDOWN_MS, 600_000)
})

Deno.test('test notification cooldown window is two minutes', () => {
  assertEquals(TEST_NOTIFICATION_COOLDOWN_MS, 120_000)
})

Deno.test('test notification cooldown skips within two minutes but allows after', () => {
  const recent = shouldSkipWorkflowDispatch(
    [
      {
        status: 'completed',
        created_at: '2026-10-09T11:59:30.000Z',
        run_started_at: '2026-10-09T11:59:30.000Z',
      },
    ],
    baseTime,
    TEST_NOTIFICATION_COOLDOWN_MS,
  )

  assertEquals(recent, { skip: true, reason: 'cooldown' })

  const older = shouldSkipWorkflowDispatch(
    [
      {
        status: 'completed',
        created_at: '2026-10-09T11:57:00.000Z',
        run_started_at: '2026-10-09T11:57:00.000Z',
      },
    ],
    baseTime,
    TEST_NOTIFICATION_COOLDOWN_MS,
  )

  assertEquals(older, { skip: false })
})

Deno.test('active runs block test notification dispatch too', () => {
  const result = shouldSkipWorkflowDispatch(
    [
      {
        status: 'queued',
        created_at: '2026-10-09T11:59:00.000Z',
        run_started_at: null,
      },
    ],
    baseTime,
    TEST_NOTIFICATION_COOLDOWN_MS,
  )

  assertEquals(result, { skip: true, reason: 'cooldown' })
})
