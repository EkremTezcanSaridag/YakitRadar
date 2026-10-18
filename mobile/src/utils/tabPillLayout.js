export const PILL_WIDTH = 52
export const PILL_HEIGHT = 30
export const PILL_RADIUS = 15
export const NARROW_TAB_WIDTH_THRESHOLD = 56

export function resolvePillWidth(itemWidth) {
  if (!Number.isFinite(itemWidth) || itemWidth <= 0) {
    return PILL_WIDTH
  }

  if (itemWidth < NARROW_TAB_WIDTH_THRESHOLD) {
    return itemWidth - 4
  }

  return PILL_WIDTH
}

/** Horizontal translateX: absolute pill uses left:0; translateX centers on tab item (padding-box coords). */
export function computeTabPillTranslateX(itemFrame) {
  if (!itemFrame || itemFrame.width <= 0) {
    return null
  }

  const pillWidth = resolvePillWidth(itemFrame.width)
  return itemFrame.x + (itemFrame.width - pillWidth) / 2
}

/** Static top for the pill (only translateX is animated). Vertically centers on icon in item. */
export function computeTabPillTop(itemFrame, iconFrame) {
  if (!itemFrame || !iconFrame || iconFrame.height <= 0) {
    return null
  }

  const iconCenterY = itemFrame.y + iconFrame.y + iconFrame.height / 2
  return iconCenterY - PILL_HEIGHT / 2
}

export function computeIconCenterX(itemFrame, iconFrame) {
  if (!itemFrame || !iconFrame || iconFrame.width <= 0) {
    return null
  }

  const iconX = Number.isFinite(iconFrame.x) ? iconFrame.x : (itemFrame.width - iconFrame.width) / 2
  return itemFrame.x + iconX + iconFrame.width / 2
}

export function computeIconCenterY(itemFrame, iconFrame) {
  if (!itemFrame || !iconFrame) {
    return null
  }

  return itemFrame.y + iconFrame.y + iconFrame.height / 2
}

export function computePillCenterX(translateX, itemWidth) {
  if (translateX == null || !Number.isFinite(translateX)) {
    return null
  }

  const pillWidth = resolvePillWidth(itemWidth)
  return translateX + pillWidth / 2
}

export function computePillCenterY(pillTop) {
  if (pillTop == null || !Number.isFinite(pillTop)) {
    return null
  }

  return pillTop + PILL_HEIGHT / 2
}

/** |pill center − icon center| for horizontal and vertical axes (dp). */
export function tabPillAlignmentDelta(itemFrame, iconFrame) {
  const translateX = computeTabPillTranslateX(itemFrame)
  const pillTop = computeTabPillTop(itemFrame, iconFrame)

  if (translateX == null || pillTop == null) {
    return null
  }

  const pillCenterX = computePillCenterX(translateX, itemFrame.width)
  const iconCenterX = computeIconCenterX(itemFrame, iconFrame)
  const pillCenterY = computePillCenterY(pillTop)
  const iconCenterY = computeIconCenterY(itemFrame, iconFrame)

  return {
    deltaX: Math.abs(pillCenterX - iconCenterX),
    deltaY: Math.abs(pillCenterY - iconCenterY),
    pillWidth: resolvePillWidth(itemFrame.width),
    translateX,
    pillTop,
  }
}

/**
 * Test fixture: five equal tabs in the floating bar (App.js margins).
 * Frames match React Native onLayout: origin at the bar padding box (inside border).
 */
export function buildTabBarFixture(screenWidth, tabCount = 5) {
  const barMargin = 14
  const paddingHorizontal = 6
  const paddingTop = 8
  const paddingBottom = 10
  const minBarHeight = 68
  const barWidth = screenWidth - barMargin * 2
  const contentWidth = barWidth - paddingHorizontal * 2
  const itemWidth = contentWidth / tabCount
  const contentHeight = minBarHeight - paddingTop - paddingBottom
  const itemHeight = 48
  const itemY = (contentHeight - itemHeight) / 2
  const iconSize = 22
  const labelBlockHeight = 2 + 14
  const iconBlockHeight = iconSize + labelBlockHeight
  const iconY = (itemHeight - iconBlockHeight) / 2
  const iconX = (itemWidth - iconSize) / 2

  const items = []
  const icons = []

  for (let index = 0; index < tabCount; index += 1) {
    items.push({
      x: index * itemWidth,
      y: itemY,
      width: itemWidth,
      height: itemHeight,
    })
    icons.push({
      x: iconX,
      y: iconY,
      height: iconSize,
      width: iconSize,
    })
  }

  return {
    items,
    icons,
    barWidth,
  }
}
