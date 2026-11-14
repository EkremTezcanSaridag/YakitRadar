const DRIVE_CALCULATION_STATION = 'Sürüş Hesabı'

function sameDay(first, second) {
  const firstDate = new Date(first)
  const secondDate = new Date(second)

  if (Number.isNaN(firstDate.getTime()) || Number.isNaN(secondDate.getTime())) {
    return false
  }

  return (
    firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate()
  )
}

function sameNumber(first, second) {
  return Math.abs((Number(first) || 0) - (Number(second) || 0)) < 0.01
}

export function isDuplicateDriveCalculation(candidate, existing) {
  if (candidate?.station !== DRIVE_CALCULATION_STATION) {
    return false
  }

  if (existing?.station !== DRIVE_CALCULATION_STATION) {
    return false
  }

  return (
    candidate.city === existing.city
    && candidate.fuelKey === existing.fuelKey
    && sameNumber(candidate.spentAmount, existing.spentAmount)
    && sameNumber(candidate.distanceKm, existing.distanceKm)
    && sameDay(candidate.createdAt, existing.createdAt)
  )
}
