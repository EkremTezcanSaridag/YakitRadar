let toastApi = null

export function registerToastApi(api) {
  toastApi = api
}

export function unregisterToastApi() {
  toastApi = null
}

export function pushToast(payload) {
  toastApi?.push(payload)
}
