import { colors } from '../theme'
import { formatDecimalTr } from '../utils/priceFormat'
import {
  buildDirectionSubtitle,
  displayFuelName,
  filterVisibleExpectedFuelSignals,
  formatTimingSuffix,
  isAfterBuGeceEffectiveMidnight,
  mapSignalFuelToKey,
  parseExpectedFuelSignals,
  shouldShowExpectedChangeBox,
} from './expectedChangeLogic'

export {
  BU_GECE_VISIBILITY_HOURS,
  EXPECTED_PUMP_TOLERANCE_TL,
  buildDirectionSubtitle,
  computeExpectedPumpPrice,
  filterVisibleExpectedFuelSignals,
  formatTimingSuffix,
  isAfterBuGeceEffectiveMidnight,
  mapSignalFuelToKey,
  parseExpectedFuelSignals,
  shouldShowExpectedChangeBox,
} from './expectedChangeLogic'

export function formatTlComma(value) {
  return formatDecimalTr(value, '--')
}

export function formatSignedChangeAmount(amountTl, direction) {
  const abs = Math.abs(amountTl)
  const body = formatTlComma(abs)

  if (direction === 'decrease') {
    return `−${body} ₺`
  }

  return `+${body} ₺`
}

export function formatAccessibleChangeLabel(fuelName, amountTl, direction) {
  const abs = Math.abs(amountTl)
  const lira = Math.floor(abs)
  const kurus = Math.round((abs - lira) * 100)
  let moneyPhrase = ''

  if (lira >= 1 && kurus > 0) {
    moneyPhrase = `${lira} lira ${kurus} kuruş`
  } else if (lira >= 1) {
    moneyPhrase = `${lira} lira`
  } else {
    moneyPhrase = `${kurus} kuruş`
  }

  const trend = direction === 'decrease' ? 'indirim' : 'zam'
  return `${fuelName}, ${moneyPhrase} ${trend} bekleniyor`
}

export function computeCityPriceRange(currentPrice, amountTl, direction) {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return null
  }

  const delta = Math.abs(amountTl)
  const next =
    direction === 'decrease' ? currentPrice - delta : currentPrice + delta

  if (!Number.isFinite(next) || next <= 0) {
    return null
  }

  return {
    from: formatTlComma(currentPrice),
    to: formatTlComma(next),
  }
}

export function enrichExpectedChanges(changes, cityRow, nowMs = Date.now()) {
  return changes.map((change) => {
    const current = Number(cityRow?.[change.fuelKey]) || 0
    const priceRange = computeCityPriceRange(current, change.amountTl, change.direction)
    const isDecrease = change.direction === 'decrease'
    const pendingPumpReflection = isAfterBuGeceEffectiveMidnight(change.effectiveAt, nowMs)

    return {
      ...change,
      accessibilityLabel: formatAccessibleChangeLabel(change.fuel, change.amountTl, change.direction),
      amountLabel: formatSignedChangeAmount(change.amountTl, change.direction),
      priceRangeLabel: priceRange ? `${priceRange.from} → ${priceRange.to} ₺` : null,
      subtitle: buildDirectionSubtitle(change.direction, change.timing, {
        pendingPumpReflection,
      }),
      tokens: isDecrease
        ? {
            bg: colors.expectedDecreaseBg,
            border: colors.expectedDecreaseBorder,
            text: colors.expectedDecrease,
          }
        : {
            bg: colors.expectedIncreaseBg,
            border: colors.expectedIncreaseBorder,
            text: colors.expectedIncrease,
          },
      trendIcon: isDecrease ? 'trending-down' : 'trending-up',
    }
  })
}

export function getExpectedChangeLayout(count) {
  if (count <= 1) {
    return [{ flexBasis: '100%', maxWidth: '100%' }]
  }

  if (count === 2) {
    return [
      { flexBasis: '48%', maxWidth: '48%' },
      { flexBasis: '48%', maxWidth: '48%' },
    ]
  }

  return [
    { flexBasis: '48%', maxWidth: '48%' },
    { flexBasis: '48%', maxWidth: '48%' },
    { flexBasis: '100%', maxWidth: '100%' },
  ]
}

// Re-export for screens that only need display names
export { displayFuelName }
