function resolveCorsHeaders(allowedInvokeHeader: string) {
  return {
    'Access-Control-Allow-Headers': `authorization, x-client-info, apikey, content-type, ${allowedInvokeHeader}`,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
  }
}

function jsonResponse(
  corsHeaders: Record<string, string>,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}

Deno.serve(async (request) => {
  const invokeSecretHeader =
    Deno.env.get('REFRESH_PRICES_INVOKE_SECRET_HEADER') ?? 'x-yakitradar-refresh-secret'
  const corsHeaders = resolveCorsHeaders(invokeSecretHeader)

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      corsHeaders,
      { message: 'Only POST requests are supported.', status: 'error' },
      405,
    )
  }

  const expectedInvokeSecret = Deno.env.get('REFRESH_PRICES_INVOKE_SECRET')

  if (!expectedInvokeSecret) {
    return jsonResponse(
      corsHeaders,
      {
        message: 'REFRESH_PRICES_INVOKE_SECRET secret is missing.',
        status: 'error',
      },
      500,
    )
  }

  const providedInvokeSecret = request.headers.get(invokeSecretHeader)

  if (!providedInvokeSecret || providedInvokeSecret !== expectedInvokeSecret) {
    return jsonResponse(corsHeaders, { message: 'Unauthorized.', status: 'error' }, 401)
  }

  const token = Deno.env.get('GITHUB_ACTION_TOKEN')
  const owner = Deno.env.get('GITHUB_OWNER') ?? 'EkremTezcanSaridag'
  const repo = Deno.env.get('GITHUB_REPO') ?? 'YakitRadar'
  const workflow = Deno.env.get('GITHUB_WORKFLOW') ?? 'guncelle.yml'
  const ref = Deno.env.get('GITHUB_REF') ?? 'main'
  const requestBody = (await request.json().catch(() => ({}))) as {
    installationId?: string
    testNotification?: boolean
  }
  const testNotification = requestBody.testNotification === true
  const installationId = requestBody.installationId?.trim()

  if (!token) {
    return jsonResponse(
      corsHeaders,
      {
        message: 'GITHUB_ACTION_TOKEN secret is missing.',
        status: 'error',
      },
      500,
    )
  }

  const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`

  try {
    const response = await fetch(dispatchUrl, {
      body: JSON.stringify({
        ref,
        inputs: testNotification
          ? {
              test_installation_id: installationId ?? '',
              test_notification: 'true',
            }
          : {},
      }),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'YakitRadarRefreshFunction',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      method: 'POST',
    })

    if (!response.ok) {
      const details = await response.text()

      return jsonResponse(
        corsHeaders,
        {
          details,
          message: `GitHub workflow dispatch failed with ${response.status}.`,
          status: 'error',
        },
        502,
      )
    }

    return jsonResponse(corsHeaders, {
      message: 'Price refresh workflow queued.',
      queuedAt: new Date().toISOString(),
      status: 'queued',
      testNotification,
    })
  } catch (error) {
    return jsonResponse(
      corsHeaders,
      {
        message: error instanceof Error ? error.message : 'Unknown refresh trigger error.',
        status: 'error',
      },
      500,
    )
  }
})
