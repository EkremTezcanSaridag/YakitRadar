const REST_V1_SUFFIX = /\/rest\/v1\/?$/i

/**
 * @returns {{ url: string, wasNormalized: boolean }}
 */
export function normalizeSupabaseUrlDetails(raw) {
  if (typeof raw !== 'string') {
    return { url: '', wasNormalized: false }
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return { url: '', wasNormalized: false }
  }

  let url = trimmed
  let wasNormalized = false

  for (;;) {
    const withoutTrailingSlashes = url.replace(/\/+$/, '')
    if (withoutTrailingSlashes !== url) {
      wasNormalized = true
      url = withoutTrailingSlashes
    }

    if (REST_V1_SUFFIX.test(url)) {
      wasNormalized = true
      url = url.replace(REST_V1_SUFFIX, '')
      continue
    }

    break
  }

  url = url.replace(/\/+$/, '')

  if (url !== trimmed) {
    wasNormalized = true
  }

  return { url, wasNormalized }
}

export function normalizeSupabaseUrl(raw) {
  return normalizeSupabaseUrlDetails(raw).url
}
