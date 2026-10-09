const FUEL_ORDER = ['benzin95', 'motorin', 'lpg']

export const EXPECTED_PUMP_TOLERANCE_TL = 0.15
export const BU_GECE_VISIBILITY_HOURS = 12
const MS_PER_HOUR = 60 * 60 * 1000

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

export function isAfterBuGeceEffectiveMidnight(effectiveAtIso, nowMs = Date.now()) {
  if (!effectiveAtIso) {
    return false
  }

  const effectiveMs = Date.parse(effectiveAtIso)

  if (!Number.isFinite(effectiveMs)) {
    return false
  }

  return nowMs >= effectiveMs
}

export function buildDirectionSubtitle(direction, timing, options = {}) {
  const kind = direction === 'decrease' ? 'İndirim' : 'Zam'

  if (options.pendingPumpReflection) {
    return `${kind} · Pompaya yansıması bekleniyor`
  }

  const suffix = formatTimingSuffix(timing)

  if (!suffix) {
    return kind
  }

  return `${kind} · ${suffix}`
}

export function computeExpectedPumpPrice(currentPrice, amountTl, direction) {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return null
  }

  if (!Number.isFinite(amountTl) || amountTl <= 0) {
    return null
  }

  const delta = Math.abs(amountTl)
  const expected =
    direction === 'decrease' ? currentPrice - delta : currentPrice + delta

  return Number.isFinite(expected) && expected > 0 ? expected : null
}

export function shouldShowExpectedChangeBox(change, cityRow, nowMs = Date.now()) {
  if (!change || !Number.isFinite(change.amountTl) || change.amountTl <= 0) {
    return false
  }

  const current = Number(cityRow?.[change.fuelKey]) || 0

  if (current <= 0) {
    return true
  }

  let targetPrice = change.expectedPumpPrice

  if (targetPrice === null && change.nationalCurrent !== null && change.nationalExpected !== null) {
    targetPrice = current + (change.nationalExpected - change.nationalCurrent)
  }

  if (targetPrice === null) {
    targetPrice = computeExpectedPumpPrice(current, change.amountTl, change.direction)
  }

  if (
    targetPrice !== null &&
    Math.abs(current - targetPrice) <= EXPECTED_PUMP_TOLERANCE_TL
  ) {
    return false
  }

  if (change.effectiveAt) {
    const effectiveMs = Date.parse(change.effectiveAt)

    if (Number.isFinite(effectiveMs)) {
      const elapsedHours = (nowMs - effectiveMs) / MS_PER_HOUR

      if (elapsedHours > BU_GECE_VISIBILITY_HOURS) {
        return false
      }
    }
  }

  return true
}

export function parseExpectedFuelSignals(signalsField) {
  if (signalsField === null || signalsField === undefined) {
    return []
  }

  const list = Array.isArray(signalsField) ? signalsField : []

  return list
    .map((signal) => {
      if (signal?.direction === 'neutral') {
        return null
      }

      const amountTl = parseFuelNumber(signal?.expected_amount_tl)

      if (amountTl === null || amountTl === 0) {
        return null
      }

      const fuelKey = mapSignalFuelToKey(signal?.fuel)
      let direction = 'increase'

      if (signal?.direction === 'decrease') {
        direction = 'decrease'
      } else if (signal?.direction === 'increase') {
        direction = 'increase'
      }

      const nationalCurrent = parseFuelNumber(signal?.current_price)
      const nationalExpected = parseFuelNumber(signal?.expected_price)
      let expectedPumpPrice = nationalExpected

      if (expectedPumpPrice === null && nationalCurrent !== null) {
        const signed = direction === 'decrease' ? -Math.abs(amountTl) : Math.abs(amountTl)
        expectedPumpPrice = nationalCurrent + signed
      }

      return {
        amountTl: Math.abs(amountTl),
        direction,
        fuel: displayFuelName(signal?.fuel, fuelKey),
        fuelKey,
        timing: signal?.timing ?? '',
        effectiveAt: signal?.effective_at ?? null,
        expectedPumpPrice,
        nationalCurrent,
        nationalExpected,
      }
    })
    .filter(Boolean)
    .sort((a, b) => FUEL_ORDER.indexOf(a.fuelKey) - FUEL_ORDER.indexOf(b.fuelKey))
}

export function filterVisibleExpectedFuelSignals(signalsField, cityRow, nowMs = Date.now()) {
  return parseExpectedFuelSignals(signalsField).filter((change) =>
    shouldShowExpectedChangeBox(change, cityRow, nowMs),
  )
}
