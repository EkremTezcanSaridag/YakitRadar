import { logError } from './logger'

function attachUnhandledRejectionListener() {
  if (typeof globalThis.addEventListener !== 'function') {
    return
  }

  globalThis.addEventListener('unhandledrejection', (event) => {
    logError('unhandledRejection', event?.reason ?? event)
  })
}

export function setupGlobalErrorHandlers() {
  const errorUtils = global.ErrorUtils

  if (errorUtils?.setGlobalHandler) {
    const defaultHandler = errorUtils.getGlobalHandler?.()

    errorUtils.setGlobalHandler((error, isFatal) => {
      logError(isFatal ? 'global_fatal' : 'global', error)
      defaultHandler?.(error, isFatal)
    })
  }

  attachUnhandledRejectionListener()
}
