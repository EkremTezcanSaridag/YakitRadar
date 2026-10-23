export const DEFAULT_TANK_CAPACITY_L = 50

function parseAmountTlPerLiter(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed === 0) {
    return null
  }

  return Math.abs(parsed)
}

function resolveTankLiters(tankLiters) {
  const parsed = Number.parseFloat(String(tankLiters ?? '').replace(',', '.'))
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }

  return DEFAULT_TANK_CAPACITY_L
}

function formatSavingsTl(total) {
  if (!Number.isFinite(total) || total <= 0) {
    return null
  }

  const rounded = Math.round(total)
  return rounded.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

export function buildExpectedChangeSavingsLine({ tankLiters, direction, amountTlPerLiter }) {
  const amountPerLiter = parseAmountTlPerLiter(amountTlPerLiter)
  const dir = String(direction || 'neutral').toLowerCase()

  if (!amountPerLiter || (dir !== 'decrease' && dir !== 'increase')) {
    return null
  }

  const tank = resolveTankLiters(tankLiters)
  const formatted = formatSavingsTl(tank * amountPerLiter)

  if (!formatted) {
    return null
  }

  const prefix = `${tank} litrelik depoya göre, `
  const body =
    dir === 'decrease'
      ? `${prefix}beklersen depoda yaklaşık ${formatted} TL kazanırsın`
      : `${prefix}şimdi doldurursan yaklaşık ${formatted} TL tasarruf edersin`

  return { body, linkLabel: 'Aracım' }
}

export function attachTankSavingsToBoxes(boxes, tankLiters) {
  return (boxes || []).map((box) => {
    const savingsLine = buildExpectedChangeSavingsLine({
      tankLiters,
      direction: box.direction,
      amountTlPerLiter: box.amountTl,
    })

    if (!savingsLine) {
      return box
    }

    return { ...box, savingsLine }
  })
}
