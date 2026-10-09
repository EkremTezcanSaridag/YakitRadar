import { shouldSkipWorkflowDispatch, type WorkflowRunSummary } from './cooldown_logic.ts'

export type GitHubConfig = {
  owner: string
  repo: string
  workflow: string
  token: string
}

export async function fetchRecentWorkflowRuns(
  config: GitHubConfig,
  fetchImpl: typeof fetch = fetch,
  perPage = 10,
): Promise<WorkflowRunSummary[]> {
  const runsUrl =
    `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow}/runs?per_page=${perPage}`

  const response = await fetchImpl(runsUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'User-Agent': 'YakitRadarRefreshFunction',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(`workflow_runs_lookup_failed:${response.status}`)
  }

  const payload = (await response.json()) as { workflow_runs?: WorkflowRunSummary[] }

  return payload.workflow_runs ?? []
}

/**
 * When the runs lookup fails, skip dispatch (fail closed) so manual refresh cannot
 * spam workflow_dispatch if GitHub status cannot be verified.
 */
export async function evaluateWorkflowCooldown(
  config: GitHubConfig,
  options: { nowMs?: number; bypassCooldown?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<{ skip: boolean; reason?: 'cooldown' | 'runs_lookup_failed' }> {
  if (options.bypassCooldown) {
    return { skip: false }
  }

  try {
    const runs = await fetchRecentWorkflowRuns(config, options.fetchImpl)
    const decision = shouldSkipWorkflowDispatch(runs, options.nowMs ?? Date.now())

    return decision
  } catch {
    return { skip: true, reason: 'runs_lookup_failed' }
  }
}
