export const REFRESH_COOLDOWN_MS = 10 * 60 * 1000
export const TEST_NOTIFICATION_COOLDOWN_MS = 2 * 60 * 1000

const ACTIVE_RUN_STATUSES = new Set(['queued', 'in_progress', 'waiting', 'pending'])

export type WorkflowRunSummary = {
  status: string
  created_at: string
  run_started_at?: string | null
}

export function shouldSkipWorkflowDispatch(
  runs: WorkflowRunSummary[],
  nowMs: number,
  cooldownMs = REFRESH_COOLDOWN_MS,
): { skip: boolean; reason?: 'cooldown' } {
  if (!runs.length) {
    return { skip: false }
  }

  for (const run of runs) {
    if (ACTIVE_RUN_STATUSES.has(run.status)) {
      return { skip: true, reason: 'cooldown' }
    }
  }

  const latest = runs[0]
  const startedAt = latest.run_started_at ?? latest.created_at
  const startedMs = Date.parse(startedAt)

  if (!Number.isNaN(startedMs) && nowMs - startedMs < cooldownMs) {
    return { skip: true, reason: 'cooldown' }
  }

  return { skip: false }
}
