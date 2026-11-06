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

  if (options.tabBarButton === null) {
    return true
  }

  return resolveDisplay(options.tabBarItemStyle) === 'none'
}
