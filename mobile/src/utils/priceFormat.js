export function formatDecimalTr(value, fallback = '--') {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return value.toFixed(2).replace('.', ',')
}

export function formatCurrencyTr(value, fallback = '--') {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return `${formatDecimalTr(value)} ₺`
}

export function formatSignedCurrencyTr(value) {
  if (!Number.isFinite(value)) {
    return '--'
  }

  const sign = value >= 0 ? '+' : '−'
  return `${sign}${formatDecimalTr(Math.abs(value))} ₺`
}

export function formatPerLiterTr(value, fallback = 'Veri yok') {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return `${formatDecimalTr(value)} ₺/L`
}
