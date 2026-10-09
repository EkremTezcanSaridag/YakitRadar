import { colors } from '../theme'
import { formatDecimalTr } from '../utils/priceFormat'

const FUEL_ORDER = ['benzin95', 'motorin', 'lpg']

function parseFuelNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const parsed = Number.parseFloat(
    String(value)
      .replace('₺', '')
      .replace('TL', '')
      .replace(/\s/g, '')
      .replace(',', '.'),
  )

  return Number.isFinite(parsed) ? parsed : null
}

export function mapSignalFuelToKey(fuelName) {
  const normalized = (fuelName ?? '').toLocaleLowerCase('tr-TR')

  if (normalized.includes('motorin')) {
    return 'motorin'
  }

  if (normalized.includes('lpg') || normalized.includes('otogaz')) {
    return 'lpg'
  }

  return 'benzin95'
}

export function displayFuelName(fuelName, fuelKey) {
  if (fuelName && fuelName.trim()) {
    return fuelName.trim()
  }

  if (fuelKey === 'motorin') {
    return 'Motorin'
  }

  if (fuelKey === 'lpg') {
    return 'LPG'
  }

  return 'Benzin'
}

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

export function formatTimingSuffix(timing) {
  if (!timing || !String(timing).trim()) {
    return ''
  }

  const raw = String(timing).trim()
  const lower = raw.toLocaleLowerCase('tr-TR')

  if (lower.includes('bu gece')) {
    return 'bu gece'
  }

  if (lower.includes('yarın')) {
    return 'yarın'
  }

  return lower
}

export function buildDirectionSubtitle(direction, timing) {
  const kind = direction === 'decrease' ? 'İndirim' : 'Zam'
  const suffix = formatTimingSuffix(timing)

  if (!suffix) {
    return kind
  }

  return `${kind} · ${suffix}`
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

export function parseExpectedFuelSignals(signalsField) {
  if (signalsField === null || signalsField === undefined) {
    return []
  }

  const list = Array.isArray(signalsField) ? signalsField : []

  return list
    .map((signal) => {
      const rawAmount = signal?.expected_amount_tl ?? signal?.expected_amount
      const amountTl = parseFuelNumber(rawAmount)

      if (amountTl === null) {
        return null
      }

      const fuelKey = mapSignalFuelToKey(signal?.fuel)
      let direction = 'increase'

      if (signal?.direction === 'decrease') {
        direction = 'decrease'
      } else if (signal?.direction === 'increase') {
        direction = 'increase'
      }

      const currentPrice = parseFuelNumber(signal?.current_price)
      const expectedPrice = parseFuelNumber(signal?.expected_price)

      return {
        amountTl: Math.abs(amountTl),
        direction,
        fuel: displayFuelName(signal?.fuel, fuelKey),
        fuelKey,
        timing: signal?.timing ?? '',
        currentPrice,
        expectedPrice,
      }
    })
    .filter(Boolean)
    .sort((a, b) => FUEL_ORDER.indexOf(a.fuelKey) - FUEL_ORDER.indexOf(b.fuelKey))
}

export function enrichExpectedChanges(changes, cityRow) {
  return changes.map((change) => {
    const current = Number(cityRow?.[change.fuelKey]) || 0
    const priceRange = computeCityPriceRange(current, change.amountTl, change.direction)
    const isDecrease = change.direction === 'decrease'

    return {
      ...change,
      accessibilityLabel: formatAccessibleChangeLabel(change.fuel, change.amountTl, change.direction),
      amountLabel: formatSignedChangeAmount(change.amountTl, change.direction),
      priceRangeLabel: priceRange ? `${priceRange.from} → ${priceRange.to} ₺` : null,
      subtitle: buildDirectionSubtitle(change.direction, change.timing),
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
