const FUEL_META = {
  benzin95: { name: 'Benzin', changeKey: 'benzinChange' },
  motorin: { name: 'Motorin', changeKey: 'motorinChange' },
  lpg: { name: 'LPG', changeKey: 'lpgChange' },
}

const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 }

function normalizeFuelLabel(value) {
  const text = String(value || '').trim().toLowerCase()
  if (text.includes('motorin')) return 'motorin'
  if (text.includes('lpg')) return 'lpg'
  return 'benzin95'
}

function pickFuelSignal(marketSignal, fuelKey) {
  const meta = FUEL_META[fuelKey] ?? FUEL_META.benzin95
  const signals = marketSignal?.signals ?? marketSignal?.expectedFuelSignals ?? marketSignal?.fuels ?? []

  return (
    signals.find((entry) => normalizeFuelLabel(entry.fuel) === fuelKey)
    ?? signals.find((entry) => String(entry.fuel || '').toLowerCase().includes(meta.name.toLowerCase()))
    ?? null
  )
}

function resolveAdvice(direction, confidence) {
  const rank = CONFIDENCE_RANK[confidence] ?? 0

  if (rank < CONFIDENCE_RANK.medium || direction === 'neutral') {
    return {
      action: 'neutral',
      headline: 'Net sinyal yok',
      detail: 'Beklenen hareket belirsiz; rutin ihtiyacınıza göre doldurabilirsiniz.',
    }
  }

  if (direction === 'decrease') {
    return {
      action: 'wait',
      headline: 'Beklemek mantıklı olabilir',
      detail: 'Piyasa analizi kısa vadede indirim yönünde; acil değilse bir sonraki güncellemeyi bekleyin.',
    }
  }

  if (direction === 'increase') {
    return {
      action: 'fill_now',
      headline: 'Şimdi doldurmak mantıklı olabilir',
      detail: 'Beklenen zam yönünde; depoyu şimdi doldurmak fiyat riskini azaltabilir.',
    }
  }

  return {
    action: 'neutral',
    headline: 'Net sinyal yok',
    detail: 'Rutin ihtiyacınıza göre karar verin.',
  }
}

function historyByDate(history) {
  const map = new Map()
  for (const row of history || []) {
    if (row?.date) {
      map.set(String(row.date).slice(0, 10), row)
    }
  }
  return map
}

function signalDirectionForFuel(record, fuelKey) {
  const signals = record?.signals ?? []
  if (!Array.isArray(signals) || !signals.length) {
    const overall = String(record?.direction || 'neutral').toLowerCase()
    return overall === 'increase' || overall === 'decrease' ? overall : 'neutral'
  }

  const match = signals.find((entry) => normalizeFuelLabel(entry.fuel) === fuelKey)
  const direction = String(match?.direction || record?.direction || 'neutral').toLowerCase()
  return direction === 'increase' || direction === 'decrease' ? direction : 'neutral'
}

export function computePredictionAccuracy(marketSignalHistory, history, fuelKey) {
  const meta = FUEL_META[fuelKey] ?? FUEL_META.benzin95
  const byDate = historyByDate(history)
  const rows = (marketSignalHistory || []).filter((row) => row?.signalDate)

  if (rows.length < 3) {
    return { evaluated: 0, hits: 0, percent: null, label: 'Yeterli veri yok' }
  }

  let evaluated = 0
  let hits = 0

  for (const row of rows) {
    const dateKey = String(row.signalDate).slice(0, 10)
    const historyRow = byDate.get(dateKey)
    if (!historyRow) {
      continue
    }

    const predicted = signalDirectionForFuel(row, fuelKey)
    if (predicted === 'neutral') {
      continue
    }

    const actualDelta = Number(historyRow[meta.changeKey])
    if (!Number.isFinite(actualDelta) || actualDelta === 0) {
      continue
    }

    evaluated += 1
    const actual = actualDelta > 0 ? 'increase' : 'decrease'
    if (actual === predicted) {
      hits += 1
    }
  }

  if (evaluated < 3) {
    return { evaluated, hits, percent: null, label: 'Yeterli veri yok' }
  }

  const percent = Math.round((hits / evaluated) * 100)
  return {
    evaluated,
    hits,
    percent,
    label: `Son ${evaluated} tahminde %${percent} isabet`,
  }
}

export function buildRefuelTimingAdvice({ marketSignal, marketSignalHistory, history, fuelKey }) {
  const meta = FUEL_META[fuelKey] ?? FUEL_META.benzin95
  const fuelSignal = pickFuelSignal(marketSignal, fuelKey)
  const direction = String(fuelSignal?.direction || marketSignal?.direction || 'neutral').toLowerCase()
  const confidence = String(fuelSignal?.confidence || marketSignal?.confidence || 'low').toLowerCase()
  const advice = resolveAdvice(direction, confidence)
  const accuracy = computePredictionAccuracy(marketSignalHistory, history, fuelKey)

  return {
    fuelName: meta.name,
    direction,
    confidence,
    confidenceLabel: marketSignal?.confidenceLabel ?? confidence,
    expectedAmount: Number(fuelSignal?.expected_amount_tl ?? fuelSignal?.expectedAmount ?? 0) || null,
    timing: fuelSignal?.timing ?? null,
    ...advice,
    accuracy,
  }
}
