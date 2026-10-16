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

/** Horizontal translateX: left:0 + translateX, pill centered on tab item frame. */
export function computeTabPillTranslateX(itemFrame, borderWidth = 0) {
  if (!itemFrame || itemFrame.width <= 0) {
    return null
  }

  const pillWidth = resolvePillWidth(itemFrame.width)
  const border = Number.isFinite(borderWidth) ? borderWidth : 0

  return itemFrame.x - border + (itemFrame.width - pillWidth) / 2
}

/** Static top for the pill (only translateX is animated). */
export function computeTabPillTop(itemFrame, iconFrame, borderWidth = 0) {
  if (!itemFrame || !iconFrame || iconFrame.height <= 0) {
    return null
  }

  const border = Number.isFinite(borderWidth) ? borderWidth : 0
  const iconCenterY = itemFrame.y + iconFrame.y + iconFrame.height / 2

  return iconCenterY - PILL_HEIGHT / 2 - border
}

export function computeTabCenterX(itemFrame, borderWidth = 0) {
  if (!itemFrame || itemFrame.width <= 0) {
    return null
  }

  const border = Number.isFinite(borderWidth) ? borderWidth : 0
  return itemFrame.x - border + itemFrame.width / 2
}

export function computePillCenterX(translateX, itemWidth) {
  if (translateX == null || !Number.isFinite(translateX)) {
    return null
  }

  const pillWidth = resolvePillWidth(itemWidth)
  return translateX + pillWidth / 2
}

export function computeIconCenterY(itemFrame, iconFrame, borderWidth = 0) {
  if (!itemFrame || !iconFrame) {
    return null
  }

  const border = Number.isFinite(borderWidth) ? borderWidth : 0
  return itemFrame.y - border + iconFrame.y + iconFrame.height / 2
}

export function computePillCenterY(pillTop) {
  if (pillTop == null || !Number.isFinite(pillTop)) {
    return null
  }

  return pillTop + PILL_HEIGHT / 2
}

/** |pill center − icon center| for horizontal and vertical axes (dp). */
export function tabPillAlignmentDelta(itemFrame, iconFrame, borderWidth = 0) {
  const translateX = computeTabPillTranslateX(itemFrame, borderWidth)
  const pillTop = computeTabPillTop(itemFrame, iconFrame, borderWidth)

  if (translateX == null || pillTop == null) {
    return null
  }

  const pillCenterX = computePillCenterX(translateX, itemFrame.width)
  const tabCenterX = computeTabCenterX(itemFrame, borderWidth)
  const pillCenterY = computePillCenterY(pillTop)
  const iconCenterY = computeIconCenterY(itemFrame, iconFrame, borderWidth)

  return {
    deltaX: Math.abs(pillCenterX - tabCenterX),
    deltaY: Math.abs(pillCenterY - iconCenterY),
    pillWidth: resolvePillWidth(itemFrame.width),
    translateX,
    pillTop,
  }
}

/** Test fixture: five equal tabs in a floating bar (App.js margins). */
export function buildTabBarFixture(screenWidth, tabCount = 5) {
  const barMargin = 14
  const borderWidth = 1
  const paddingHorizontal = 6
  const barWidth = screenWidth - barMargin * 2
  const innerWidth = barWidth - borderWidth * 2 - paddingHorizontal * 2
  const itemWidth = innerWidth / tabCount
  const iconSize = 22
  const paddingTop = 8
  const itemHeight = 48
  const iconY = (itemHeight - iconSize) / 2

  const items = []
  const icons = []

  for (let index = 0; index < tabCount; index += 1) {
    const innerLeft = borderWidth + paddingHorizontal + index * itemWidth
    const itemX = innerLeft + borderWidth
    const innerTop = borderWidth + paddingTop
    const itemY = innerTop + borderWidth
    items.push({
      x: itemX,
      y: itemY,
      width: itemWidth,
      height: itemHeight,
    })
    icons.push({
      y: iconY,
      height: iconSize,
      width: iconSize,
    })
  }

  return {
    borderWidth,
    items,
    icons,
    barWidth,
  }
}
