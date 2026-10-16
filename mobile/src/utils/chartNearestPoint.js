const SHORT_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const WEEK_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

/** Pick the chart point whose x is closest to touchX. */
export function pickNearestChartPointIndex(touchX, points) {
  if (!Array.isArray(points) || points.length === 0) {
    return -1
  }

  if (!Number.isFinite(touchX)) {
    return -1
  }

  let bestIndex = 0
  let bestDistance = Infinity

  for (let index = 0; index < points.length; index += 1) {
    const x = points[index]?.x
    if (!Number.isFinite(x)) {
      continue
    }

    const distance = Math.abs(x - touchX)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  return bestIndex
}

export function formatHistoryChartTooltipDate(dateValue) {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return String(dateValue ?? '')
  }

  const day = date.getDate()
  const month = SHORT_MONTHS[date.getMonth()]
  const weekday = WEEK_DAYS[date.getDay()]

  return `${day} ${month} ${weekday}`
}

export function clampChartTooltipLeft(centerX, bubbleWidth, canvasWidth, margin = 8) {
  if (!Number.isFinite(centerX) || !Number.isFinite(bubbleWidth) || bubbleWidth <= 0) {
    return margin
  }

  const half = bubbleWidth / 2
  const minLeft = margin
  const maxLeft = Math.max(margin, canvasWidth - bubbleWidth - margin)
  const idealLeft = centerX - half

  return Math.min(Math.max(idealLeft, minLeft), maxLeft)
}
