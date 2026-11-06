/**
 * Routes hidden via tabBarButton: () => null and/or display:none must be excluded from
 * custom tab bars that assume icon/layout data exists for every route.
 *
 * Kept free of react-native imports so Node-based layout tests can import this module.
 */
function resolveDisplay(style) {
  if (style == null) {
    return undefined
  }

  if (Array.isArray(style)) {
    let display
    for (const part of style) {
      const next = resolveDisplay(part)
      if (next !== undefined) {
        display = next
      }
    }
    return display
  }

  if (typeof style === 'object' && style.display != null) {
    return style.display
  }

  return undefined
}

export function isTabBarRouteHidden(options) {
  if (!options) {
    return false
  }

  // Hidden tab: explicit `tabBarButton: null` or a custom renderer (e.g. `() => null`).
  // Omitted `tabBarButton` is not hidden — default tab button is used.
  if (options.tabBarButton === null || typeof options.tabBarButton === 'function') {
    return true
  }

  return resolveDisplay(options.tabBarItemStyle) === 'none'
}

/** Routes with missing descriptors are not drawn in a custom tab bar. */
export function filterVisibleTabBarRoutes(routes, descriptors) {
  if (!Array.isArray(routes) || !descriptors) {
    return []
  }

  return routes.filter((route) => {
    const descriptor = descriptors[route.key]
    if (!descriptor) {
      return false
    }
    return !isTabBarRouteHidden(descriptor.options)
  })
}
