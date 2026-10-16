const DEFAULT_TIMEOUT_MS = 10_000

export function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timeoutId

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('request_timeout'))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
}

export const FUEL_FETCH_TIMEOUT_MS = DEFAULT_TIMEOUT_MS
