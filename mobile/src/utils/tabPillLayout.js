export function mergeTabBarContentFrame(pressableFrame, contentFrame) {
  if (!pressableFrame || !contentFrame) {
    return null
  }

  if (pressableFrame.width <= 0 || contentFrame.width <= 0) {
    return null
  }

  return {
    x: pressableFrame.x + contentFrame.x,
    width: contentFrame.width,
  }
}

/** Horizontal translateX for a pill centered on the measured tab content frame. */
export function computeTabPillTranslateX(tabFrame, pillWidth) {
  if (!tabFrame || tabFrame.width <= 0 || !Number.isFinite(pillWidth)) {
    return null
  }

  return tabFrame.x + (tabFrame.width - pillWidth) / 2
}
