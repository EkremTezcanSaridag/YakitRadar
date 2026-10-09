import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

import { evaluateWorkflowCooldown } from './github_workflow.ts'

const baseTime = Date.parse('2026-10-09T12:00:00.000Z')

Deno.test('evaluateWorkflowCooldown uses shorter window for test notifications', async () => {
  const fetchImpl = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          workflow_runs: [
            {
              status: 'completed',
              created_at: '2026-10-09T11:57:30.000Z',
              run_started_at: '2026-10-09T11:57:30.000Z',
            },
          ],
        }),
        { status: 200 },
      ),
    )

  const refreshDecision = await evaluateWorkflowCooldown(
    { owner: 'o', repo: 'r', workflow: 'guncelle.yml', token: 't' },
    { nowMs: baseTime, testNotification: false, fetchImpl },
  )
  const testDecision = await evaluateWorkflowCooldown(
    { owner: 'o', repo: 'r', workflow: 'guncelle.yml', token: 't' },
    { nowMs: baseTime, testNotification: true, fetchImpl },
  )

  assertEquals(refreshDecision, { skip: true, reason: 'cooldown' })
  assertEquals(testDecision, { skip: false })
})

Deno.test('evaluateWorkflowCooldown fails closed when lookup fails', async () => {
  const fetchImpl = () => Promise.resolve(new Response('nope', { status: 500 }))

  const decision = await evaluateWorkflowCooldown(
    { owner: 'o', repo: 'r', workflow: 'guncelle.yml', token: 't' },
    { testNotification: true, fetchImpl },
  )

  assertEquals(decision, { skip: true, reason: 'runs_lookup_failed' })
})
