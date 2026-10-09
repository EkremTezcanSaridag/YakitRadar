import { colors } from '../theme'
import { supabase } from '../supabase'
import { parseExpectedFuelSignals } from './expectedChange'
import { formatCurrencyTr, formatSignedCurrencyTr } from '../utils/priceFormat'

export const fuelTabs = [
  { key: 'benzin95', label: 'Benzin', title: 'Benzin 95', icon: 'gas-station' },
  { key: 'motorin', label: 'Motorin', title: 'Motorin', icon: 'truck-outline' },
  { key: 'lpg', label: 'LPG', title: 'LPG', icon: 'fire' },
]

export const provinceNames = [
  'Adana',
  'Adıyaman',
  'Afyonkarahisar',
  'Ağrı',
  'Amasya',
  'Ankara',
  'Antalya',
  'Artvin',
  'Aydın',
  'Balıkesir',
  'Bilecik',
  'Bingöl',
  'Bitlis',
  'Bolu',
  'Burdur',
  'Bursa',
  'Çanakkale',
  'Çankırı',
  'Çorum',
  'Denizli',
  'Diyarbakır',
  'Edirne',
  'Elazığ',
  'Erzincan',
  'Erzurum',
  'Eskişehir',
  'Gaziantep',
  'Giresun',
  'Gümüşhane',
  'Hakkari',
  'Hatay',
  'Isparta',
  'Mersin',
  'İstanbul',
  'İzmir',
  'Kars',
  'Kastamonu',
  'Kayseri',
  'Kırklareli',
  'Kırşehir',
  'Kocaeli',
  'Konya',
  'Kütahya',
  'Malatya',
  'Manisa',
  'Kahramanmaraş',
  'Mardin',
  'Muğla',
  'Muş',
  'Nevşehir',
  'Niğde',
  'Ordu',
  'Rize',
  'Sakarya',
  'Samsun',
  'Siirt',
  'Sinop',
  'Sivas',
  'Tekirdağ',
  'Tokat',
  'Trabzon',
  'Tunceli',
  'Şanlıurfa',
  'Uşak',
  'Van',
  'Yozgat',
  'Zonguldak',
  'Aksaray',
  'Bayburt',
  'Karaman',
  'Kırıkkale',
  'Batman',
  'Şırnak',
  'Bartın',
  'Ardahan',
  'Iğdır',
  'Yalova',
  'Karabük',
  'Kilis',
  'Osmaniye',
  'Düzce',
]

const signalToneConfig = {
  increase: {
    color: colors.danger,
    icon: 'trending-up',
    softColor: colors.dangerDark,
    title: 'Artış baskısı',
    tone: 'bad',
  },
  decrease: {
    color: colors.success,
    icon: 'trending-down',
    softColor: colors.successDark,
    title: 'İndirim baskısı',
    tone: 'good',
  },
  neutral: {
    color: colors.info,
    icon: 'swap-horizontal',
    softColor: colors.surfaceAlt,
    title: 'Nötr sinyal',
    tone: 'flat',
  },
}

function predictionPillTokens(isInc, isDec) {
  if (isInc) {
    return {
      pillBg: colors.dangerDark,
      pillBorder: colors.danger,
      textColor: colors.danger,
    }
  }
  if (isDec) {
    return {
      pillBg: colors.successDark,
      pillBorder: colors.success,
      textColor: colors.success,
    }
  }
  return {
    pillBg: colors.selected,
    pillBorder: colors.border,
    textColor: colors.muted,
  }
}

const neutralPredictionPill = predictionPillTokens(false, false)
const confidenceLabels = {
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük',
}

export function getRealPriceRows(prices = []) {
  return (prices ?? []).filter(
    (row) =>
      row?.dataUpdatedAt
      && row.city
      && (Number(row.benzin95) > 0 || Number(row.motorin) > 0 || Number(row.lpg) > 0),
  )
}

export function buildDetailedFuelPredictions(direction, score, confidence, prices = [], marketSignal = null) {
  const realPrices = getRealPriceRows(prices)
  const avgBenzin = realPrices.length
    ? realPrices.reduce((s, p) => s + (p.benzin95 || 0), 0) / realPrices.length
    : 0
  const avgMotorin = realPrices.length
    ? realPrices.reduce((s, p) => s + (p.motorin || 0), 0) / realPrices.length
    : 0
  const avgLpg = realPrices.length ? realPrices.reduce((s, p) => s + (p.lpg || 0), 0) / realPrices.length : 0

  const summary = (marketSignal?.summary || '').toLowerCase()
  const isSummaryApplied = summary.includes('yansı') || summary.includes('yansi') || summary.includes('uygulan') || summary.includes('değişti') || summary.includes('degisti')
  const isOverallNeutral = direction === 'neutral' || isSummaryApplied

  const fuels = marketSignal?.fuels || []
  const benzinSignal = fuels.find((f) => f.fuel?.toLowerCase().includes('benzin'))
  const motorinSignal = fuels.find((f) => f.fuel?.toLowerCase().includes('motorin'))
  const lpgSignal = fuels.find((f) => f.fuel?.toLowerCase().includes('lpg'))

  // Motorin
  const rawMotorinDir = isOverallNeutral ? 'neutral' : (motorinSignal?.direction || 'neutral')
  const motorinAmt = isOverallNeutral ? 0 : (Number(motorinSignal?.expectedAmount) || 0)
  const motorinDir = motorinAmt > 0 && !isOverallNeutral ? rawMotorinDir : 'neutral'
  const isMotorinInc = motorinDir === 'increase' && motorinAmt > 0
  const isMotorinDec = motorinDir === 'decrease' && motorinAmt > 0

  // Benzin
  const rawBenzinDir = isOverallNeutral ? 'neutral' : (benzinSignal?.direction || 'neutral')
  const benzinAmt = isOverallNeutral ? 0 : (Number(benzinSignal?.expectedAmount) || 0)
  const benzinDir = benzinAmt > 0 && !isOverallNeutral ? rawBenzinDir : 'neutral'
  const isBenzinInc = benzinDir === 'increase' && benzinAmt > 0
  const isBenzinDec = benzinDir === 'decrease' && benzinAmt > 0

  // LPG
  const lpgDir = 'neutral'
  const lpgAmt = 0

  return [
    {
      key: 'benzin95',
      fuelName: 'Benzin 95',
      icon: 'gas-station',
      direction: benzinDir,
      statusText: isBenzinInc ? 'ZAM BEKLENİYOR' : isBenzinDec ? 'İNDİRİM BEKLENİYOR' : 'SABİT / DEĞİŞİM YOK',
      ...predictionPillTokens(isBenzinInc, isBenzinDec),
      amountText: isBenzinInc ? `+${benzinAmt.toFixed(2)} ₺` : isBenzinDec ? `-${benzinAmt.toFixed(2)} ₺` : '0.00 ₺',
      targetDate: isBenzinInc || isBenzinDec ? (benzinSignal?.timing || 'Bu Gece 00:00') : 'Gündemde Değişim Yok',
      currentPrice: `${avgBenzin.toFixed(2)} ₺`,
      expectedPrice: `${(avgBenzin + (isBenzinInc ? benzinAmt : isBenzinDec ? -benzinAmt : 0)).toFixed(2)} ₺`,
    },
    {
      key: 'motorin',
      fuelName: 'Motorin',
      icon: 'truck-outline',
      direction: motorinDir,
      statusText: isMotorinInc ? 'ZAM BEKLENİYOR' : isMotorinDec ? 'İNDİRİM BEKLENİYOR' : 'SABİT / DEĞİŞİM YOK',
      ...predictionPillTokens(isMotorinInc, isMotorinDec),
      amountText: isMotorinInc ? `+${motorinAmt.toFixed(2)} ₺` : isMotorinDec ? `-${motorinAmt.toFixed(2)} ₺` : '0.00 ₺',
      targetDate: isMotorinInc || isMotorinDec ? (motorinSignal?.timing || 'Bu Gece 00:00') : 'Gündemde Değişim Yok',
      currentPrice: `${avgMotorin.toFixed(2)} ₺`,
      expectedPrice: `${(avgMotorin + (isMotorinInc ? motorinAmt : isMotorinDec ? -motorinAmt : 0)).toFixed(2)} ₺`,
    },
    {
      key: 'lpg',
      fuelName: 'LPG (Otogaz)',
      icon: 'fire',
      direction: lpgDir,
      statusText: 'SABİT / DEĞİŞİM YOK',
      ...neutralPredictionPill,
      amountText: '0.00 ₺',
      targetDate: 'Gündemde Değişim Yok',
      currentPrice: `${avgLpg.toFixed(2)} ₺`,
      expectedPrice: `${avgLpg.toFixed(2)} ₺`,
    },
  ]
}

const brentSources = [
  {
    dateField: 'Date',
    name: 'DataHub Brent Daily',
    priceFields: ['Price'],
    url: 'https://datahub.io/core/oil-prices/r/brent-daily.csv',
  },
  {
    dateField: 'observation_date',
    name: 'FRED DCOILBRENTEU',
    priceFields: ['DCOILBRENTEU', 'Price'],
    url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU',
  },
]
const fuelSignalFactors = {
  Benzin: 1,
  Motorin: 1.12,
  LPG: 0.72,
}
const monthNames = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]
const shortMonthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const weekDayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

function parseFuelValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number.parseFloat(
    value
      .replace('₺', '')
      .replace('TL', '')
      .replace(/\s/g, '')
      .replace(',', '.'),
  )

  return Number.isFinite(parsed) ? parsed : null
}

function parseMarketNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number.parseFloat(value.trim().replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : null
}

function formatCurrency(value) {
  return formatCurrencyTr(value)
}

function formatChange(value) {
  return formatSignedCurrencyTr(value)
}

function formatStationCount(value) {
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} istasyon`
}

function formatShortDate(dateValue) {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return dateValue
  }

  return `${String(date.getDate()).padStart(2, '0')} ${shortMonthNames[date.getMonth()]}`
}

function formatLongDate(dateValue) {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return dateValue
  }

  return `${String(date.getDate()).padStart(2, '0')} ${monthNames[date.getMonth()]} ${weekDayNames[date.getDay()]}`
}

function formatTodayLabel() {
  const date = new Date()

  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()} ${weekDayNames[date.getDay()]}`
}

function formatSyncTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

function formatSyncTimeHm(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const GUNCELLEME_TEXT_RE = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/
const DATA_CHECK_STALE_MS = 3 * 60 * 60 * 1000

function parseGuncellemeIstanbul(value) {
  if (!value) {
    return null
  }

  const match = String(value).trim().match(GUNCELLEME_TEXT_RE)

  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute] = match
  const instant = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+03:00`)

  if (Number.isNaN(instant.getTime())) {
    return null
  }

  return {
    hm: `${hour}:${minute}`,
    instant,
  }
}

function formatHmEuropeIstanbul(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function buildSonKontrolMeta(prices, syncedAt) {
  let latest = null

  for (const row of prices) {
    const parsed = parseGuncellemeIstanbul(row.dataUpdatedAt)

    if (!parsed) {
      continue
    }

    if (!latest || parsed.instant > latest.instant) {
      latest = parsed
    }
  }

  if (latest) {
    return {
      dataCheckStale: Date.now() - latest.instant.getTime() > DATA_CHECK_STALE_MS,
      lastUpdatedHm: latest.hm,
      lastUpdatedLabel: 'Son kontrol',
    }
  }

  return {
    dataCheckStale: Date.now() - syncedAt.getTime() > DATA_CHECK_STALE_MS,
    lastUpdatedHm: formatHmEuropeIstanbul(syncedAt),
    lastUpdatedLabel: 'Son kontrol',
  }
}

function formatSignalTime(dateValue) {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatUsd(value) {
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : '--'
}

function formatRate(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '--'
}

function formatPercentValue(value) {
  if (!Number.isFinite(value)) {
    return '--'
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatSummaryPercent(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function parseCsvRows(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return []
  }

  const headers = lines[0].split(',').map((header) => header.trim())

  return lines.slice(1).map((line) => {
    const columns = line.split(',')

    return headers.reduce((row, header, index) => {
      row[header] = columns[index]?.trim()
      return row
    }, {})
  })
}

function parseMarketDate(value) {
  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime()) ? null : date
}

function compareMarketDates(first, second) {
  return first.date.getTime() - second.date.getTime()
}

function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return 0
  }

  return Number.parseFloat((((current - previous) / previous) * 100).toFixed(2))
}

function safeHistoryValue(records, offset, field) {
  if (!records.length) {
    return null
  }

  const index = Math.max(0, records.length - 1 - offset)

  return records[index]?.[field] ?? null
}

function multiplyMarketValues(first, second) {
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null
  }

  return first * second
}

function resolveSignalDirection(indexChange3d, indexChange7d) {
  const decisiveChange = Math.abs(indexChange3d) >= 2.5 ? indexChange3d : indexChange7d

  if (decisiveChange >= 2.5) {
    return 'increase'
  }

  if (decisiveChange <= -2.5) {
    return 'decrease'
  }

  return 'neutral'
}

function resolveSignalConfidence(indexChange3d, indexChange7d) {
  const pressure = Math.max(Math.abs(indexChange3d), Math.abs(indexChange7d))

  if (pressure >= 5) {
    return 'high'
  }

  if (pressure >= 2.5) {
    return 'medium'
  }

  return 'low'
}

function parseJsonList(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)

      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  return {}
}

function normalizeSignalDirection(direction) {
  return signalToneConfig[direction] ? direction : 'neutral'
}

function normalizeSignalConfidence(confidence) {
  return confidenceLabels[confidence] ? confidence : 'low'
}

function buildFuelSignalLabel(direction) {
  return signalToneConfig[normalizeSignalDirection(direction)].title
}

async function fetchText(url, timeoutMs = 10000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/plain, application/xml, text/xml, */*',
      },
      signal: controller?.signal,
    })

    if (!response.ok) {
      throw new Error(`Kaynak yanit vermedi: ${response.status}`)
    }

    return response.text()
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

async function fetchBrentHistory(limit = 12) {
  let lastError = null

  for (const source of brentSources) {
    try {
      const text = await fetchText(source.url)
      const records = parseCsvRows(text)
        .map((row) => {
          const dateValue = row[source.dateField] ?? row.Date
          const price = source.priceFields.reduce(
            (selected, field) => selected ?? parseMarketNumber(row[field]),
            null,
          )
          const date = dateValue ? parseMarketDate(dateValue) : null

          if (!date || price === null) {
            return null
          }

          return {
            date,
            price,
            source: source.name,
            sourceUrl: source.url,
          }
        })
        .filter(Boolean)
        .sort(compareMarketDates)

      if (records.length) {
        return records.slice(-limit)
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('Brent verisi alınamadı.')
}

const FALLBACK_USD_TRY = 34.50

async function fetchUsdTryToday() {
  for (let extraDays = 0; extraDays < 5; extraDays += 1) {
    try {
      return await fetchUsdTryForDate(createDateOffset(extraDays), 5000)
    } catch {}
  }

  return {
    date: new Date(),
    rate: FALLBACK_USD_TRY,
    source: 'TCMB Referans',
    sourceUrl: 'https://www.tcmb.gov.tr/kurlar/today.xml',
  }
}

function padDatePart(value) {
  return String(value).padStart(2, '0')
}

function createDateOffset(daysAgo) {
  const date = new Date()

  date.setDate(date.getDate() - daysAgo)

  return date
}

function buildTcmbUrl(date) {
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()

  if (isToday) {
    return 'https://www.tcmb.gov.tr/kurlar/today.xml'
  }

  const day = padDatePart(date.getDate())
  const month = padDatePart(date.getMonth() + 1)
  const year = date.getFullYear()

  return `https://www.tcmb.gov.tr/kurlar/${year}${month}/${day}${month}${year}.xml`
}

async function fetchUsdTryForDate(date, timeoutMs = 8000) {
  const url = buildTcmbUrl(date)
  const text = await fetchText(url, timeoutMs)
  const usdMatch = text.match(/<Currency[^>]+CurrencyCode="USD"[\s\S]*?<\/Currency>/)
  const usdBlock = usdMatch?.[0] ?? ''
  const selling = usdBlock.match(/<ForexSelling>([^<]+)<\/ForexSelling>/)?.[1]
  const buying = usdBlock.match(/<ForexBuying>([^<]+)<\/ForexBuying>/)?.[1]
  const rate = parseMarketNumber(selling) ?? parseMarketNumber(buying)

  if (rate === null) {
    throw new Error('TCMB USD/TL verisi alınamadı.')
  }

  return {
    date,
    rate,
    source: 'TCMB',
    sourceUrl: url,
  }
}

async function fetchUsdTryNearOffset(daysAgo) {
  for (let extraDays = 0; extraDays < 5; extraDays += 1) {
    try {
      return await fetchUsdTryForDate(createDateOffset(daysAgo + extraDays), 5000)
    } catch {}
  }

  return null
}

async function fetchUsdTrySnapshot() {
  const [current, previous3d, previous7d] = await Promise.all([
    fetchUsdTryToday(),
    fetchUsdTryNearOffset(3),
    fetchUsdTryNearOffset(7),
  ])

  return {
    current,
    previous3d: previous3d ?? current,
    previous7d: previous7d ?? previous3d ?? current,
  }
}

function buildLiveFuelSignals(direction, confidence, score) {
  return Object.entries(fuelSignalFactors).map(([fuel, factor]) => {
    const fuelScore = Math.min(100, Math.round(score * factor))
    const fuelDirection = fuel === 'LPG' && fuelScore < 42 ? 'neutral' : direction
    const fuelConfidence = fuel === 'LPG' && fuelScore < 42 ? 'low' : confidence

    return {
      confidence: fuelConfidence,
      confidenceLabel: confidenceLabels[fuelConfidence],
      direction: fuelDirection,
      fuel,
      label: buildFuelSignalLabel(fuelDirection),
      score: fuelScore,
    }
  })
}

function buildLiveMarketSummary(direction, confidence, indexChange3d, indexChange7d, brentChange3d, usdChange3d) {
  const confidenceText = {
    high: 'güçlü',
    medium: 'orta',
    low: 'düşük',
  }[confidence]
  const decisiveDays = Math.abs(indexChange3d) >= 2.5 ? 3 : 7
  const decisiveChange = decisiveDays === 3 ? indexChange3d : indexChange7d

  if (direction === 'increase') {
    return `Brent TL endeksi ${decisiveDays} piyasa gününde ${formatSummaryPercent(decisiveChange)} yükseldi. Brent ${formatSummaryPercent(brentChange3d)}, USD/TL ${formatSummaryPercent(usdChange3d)} hareket etti; yukarı yönlü ${confidenceText} sinyal oluştu.`
  }

  if (direction === 'decrease') {
    return `Brent TL endeksi ${decisiveDays} piyasa gününde ${formatSummaryPercent(Math.abs(decisiveChange))} geriledi. Brent ${formatSummaryPercent(brentChange3d)}, USD/TL ${formatSummaryPercent(usdChange3d)} hareket etti; aşağı yönlü ${confidenceText} sinyal oluştu.`
  }

  return `Brent TL endeksi 3 piyasa gününde ${formatSummaryPercent(indexChange3d)} değişti. Pompa fiyatları için belirgin bir yukarı ya da aşağı baskı oluşmadı.`
}

async function fetchLiveMarketSignal() {
  const [brentHistory, usdTry] = await Promise.all([fetchBrentHistory(), fetchUsdTrySnapshot()])
  const latestBrent = brentHistory[brentHistory.length - 1]
  const previousBrent3d = safeHistoryValue(brentHistory, 3, 'price')
  const previousBrent7d = safeHistoryValue(brentHistory, 7, 'price')
  const currentIndex = multiplyMarketValues(latestBrent?.price, usdTry.current.rate)
  const index3d = multiplyMarketValues(previousBrent3d, usdTry.previous3d.rate)
  const index7d = multiplyMarketValues(previousBrent7d, usdTry.previous7d.rate)

  if (!Number.isFinite(currentIndex) || !Number.isFinite(index3d) || !Number.isFinite(index7d)) {
    throw new Error('Piyasa sinyali için yeterli canlı veri yok.')
  }

  const brentChange3d = percentChange(latestBrent.price, previousBrent3d)
  const usdChange3d = percentChange(usdTry.current.rate, usdTry.previous3d.rate)
  const indexChange3d = percentChange(currentIndex, index3d)
  const indexChange7d = percentChange(currentIndex, index7d)
  const direction = resolveSignalDirection(indexChange3d, indexChange7d)
  const confidence = resolveSignalConfidence(indexChange3d, indexChange7d)
  const score = Math.min(100, Math.round(Math.max(Math.abs(indexChange3d), Math.abs(indexChange7d)) * 12))
  const tone = signalToneConfig[direction]
  const calculatedAt = new Date()

  return {
    analysisFactors: [],
    color: tone.color,
    confidence,
    confidenceLabel: confidenceLabels[confidence],
    direction,
    fuelPredictions: buildDetailedFuelPredictions(direction, score, confidence),
    fuels: buildLiveFuelSignals(direction, confidence, score),
    icon: tone.icon,
    metrics: [
      { label: 'Brent', value: formatUsd(latestBrent.price) },
      { label: 'USD/TL', value: formatRate(usdTry.current.rate) },
      { label: '7 gün', value: formatPercentValue(indexChange7d) },
    ],
    newsItems: [],
    score,
    softColor: tone.softColor,
    summary: buildLiveMarketSummary(direction, confidence, indexChange3d, indexChange7d, brentChange3d, usdChange3d),
    title: tone.title,
    updatedAt: formatSignalTime(calculatedAt),
  }
}

function normalizePriceRecord(record, index) {
  const city = record.il ?? record.city ?? record.name ?? provinceNames[index]
  const dataUpdatedAt = record.guncelleme ?? record.updated_at ?? null
  const benzin95 = parseFuelValue(record.benzin_95 ?? record.benzin95)
  const motorin = parseFuelValue(record.motorin)
  const lpg = parseFuelValue(record.lpg)

  if (!city || !dataUpdatedAt) {
    return null
  }

  if (!benzin95 && !motorin && !lpg) {
    return null
  }

  return {
    city,
    benzin95: benzin95 ?? 0,
    motorin: motorin ?? 0,
    lpg: lpg ?? 0,
    updatedAt: dataUpdatedAt,
    dataUpdatedAt,
  }
}

function normalizeHistoryRecord(record) {
  return {
    date: record.tarih ?? record.date,
    benzin95: parseFuelValue(record.benzin_95 ?? record.benzin95) ?? 0,
    motorin: parseFuelValue(record.motorin) ?? 0,
    lpg: parseFuelValue(record.lpg) ?? 0,
    benzinChange: parseFuelValue(record.benzin_degisim ?? record.benzinChange) ?? 0,
    motorinChange: parseFuelValue(record.motorin_degisim ?? record.motorinChange) ?? 0,
    lpgChange: parseFuelValue(record.lpg_degisim ?? record.lpgChange) ?? 0,
  }
}

export function deduplicateHistoryRecords(records = []) {
  const map = new Map()
  for (const record of records) {
    if (record && record.date) {
      map.set(record.date, record)
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function normalizePriceChangeEvent(record) {
  const diff = parseFuelValue(record.diff) ?? 0

  return {
    city: record.city ?? 'Turkiye geneli',
    diff,
    direction: record.direction === 'decrease' || diff < 0 ? 'decrease' : 'increase',
    eventAt: record.event_at ?? record.created_at ?? new Date().toISOString(),
    fuel: record.fuel ?? 'Yakit',
    newPrice: parseFuelValue(record.new_price),
    oldPrice: parseFuelValue(record.old_price),
  }
}

function normalizeMarketSignalRecord(record) {
  if (!record) {
    return null
  }

  const direction = normalizeSignalDirection(record.direction)
  const confidence = normalizeSignalConfidence(record.confidence)
  const tone = signalToneConfig[direction]
  const signalsFieldPresent = record.signals !== null && record.signals !== undefined
  const rawFuelSignals = signalsFieldPresent ? parseJsonList(record.signals) : []
  const analysis = parseJsonObject(record.analysis)
  const rawFactors = parseJsonList(analysis.factors)
  const rawNewsItems = parseJsonList(record.news_items)
  const lookbackHours = Number(analysis.lookback_hours) || 24
  const fuels = rawFuelSignals.length
    ? rawFuelSignals.map((signal) => {
        const fuelDirection = normalizeSignalDirection(signal.direction)
        const fuelConfidence = normalizeSignalConfidence(signal.confidence)

        return {
          confidenceLabel: confidenceLabels[fuelConfidence],
          direction: fuelDirection,
          fuel: signal.fuel ?? 'Yakıt',
          label: buildFuelSignalLabel(fuelDirection),
          score: Number(signal.score) || 0,
          expectedAmount: Number(signal.expected_amount) || 0,
          timing: signal.timing ?? (fuelDirection !== 'neutral' ? 'Bu Gece 00:00' : 'Gündemde Değişim Yok'),
        }
      })
    : []
  const analysisFactors = rawFactors.length
    ? rawFactors.slice(0, 6).map((factor) => ({
        detail: factor.detail ?? '',
        label: factor.label ?? 'Faktör',
        tone: normalizeSignalDirection(factor.tone),
        value: factor.value ?? '--',
      }))
    : []
  const newsItems = rawNewsItems.length
    ? rawNewsItems
        .slice(0, 3)
        .map((item) => ({
          priceMentions: parseJsonList(item.price_mentions)
            .map((mention) => mention?.display)
            .filter(Boolean)
            .slice(0, 2),
          source: item.source ?? 'Haber',
          title: item.title ?? '',
        }))
        .filter((item) => item.title)
    : []

  return {
    analysisFactors,
    color: tone.color,
    confidence,
    confidenceLabel: confidenceLabels[confidence],
    direction,
    fuels,
    icon: tone.icon,
    metrics: [
      { label: 'Haber', value: `${rawNewsItems.length} başlık` },
      { label: 'Skor', value: String(Number(record.score) || 0) },
      { label: 'Pencere', value: `${lookbackHours}s` },
    ],
    newsItems,
    score: Number(record.score) || 0,
    softColor: tone.softColor,
    summary: record.summary ?? '',
    title: tone.title,
    updatedAt: formatSignalTime(record.calculated_at ?? record.signal_date),
    expectedFuelSignals: signalsFieldPresent ? parseExpectedFuelSignals(rawFuelSignals) : [],
  }
}

function average(values) {
  const validValues = values.filter((value) => Number.isFinite(value))

  if (!validValues.length) {
    return 0
  }

  return validValues.reduce((total, value) => total + value, 0) / validValues.length
}

export function computeNationalAverages(prices = []) {
  const rows = getRealPriceRows(prices)
  return {
    benzin95: average(rows.map((row) => row.benzin95).filter((value) => value > 0)),
    motorin: average(rows.map((row) => row.motorin).filter((value) => value > 0)),
    lpg: average(rows.map((row) => row.lpg).filter((value) => value > 0)),
  }
}

function getTone(change) {
  if (change > 0) {
    return 'bad'
  }

  if (change < 0) {
    return 'good'
  }

  return 'flat'
}

function buildHomeFuels(prices, history) {
  const latestHistory = history[history.length - 1]
  const benzinAvg = average(prices.map((item) => item.benzin95)) || 0
  const motorinAvg = average(prices.map((item) => item.motorin)) || 0
  const lpgAvg = average(prices.map((item) => item.lpg)) || 0

  const benzinChange = latestHistory?.benzinChange ?? 0
  const motorinChange = latestHistory?.motorinChange ?? 0
  const lpgChange = latestHistory?.lpgChange ?? 0

  const benzinPct = benzinAvg ? ((Math.abs(benzinChange) / (benzinAvg - benzinChange || 1)) * 100).toFixed(1) : '0.0'
  const motorinPct = motorinAvg ? ((Math.abs(motorinChange) / (motorinAvg - motorinChange || 1)) * 100).toFixed(1) : '0.0'
  const lpgPct = lpgAvg ? ((Math.abs(lpgChange) / (lpgAvg - lpgChange || 1)) * 100).toFixed(1) : '0.0'

  const dateLabel = latestHistory?.shortDate ? latestHistory.shortDate : 'Bugün'

  return [
    {
      name: 'Benzin 95',
      price: formatCurrency(benzinAvg),
      change: formatChange(benzinChange),
      changePct: benzinChange > 0 ? `+${benzinPct}%` : benzinChange < 0 ? `-${benzinPct}%` : '0.0%',
      rawChange: benzinChange,
      tone: getTone(benzinChange),
      stripeColor: colors.fuelStripeBenzin,
      cardBg: colors.surface,
      cardBorder: colors.border,
      icon: 'gas-station',
      dateLabel,
    },
    {
      name: 'Motorin',
      price: formatCurrency(motorinAvg),
      change: formatChange(motorinChange),
      changePct: motorinChange > 0 ? `+${motorinPct}%` : motorinChange < 0 ? `-${motorinPct}%` : '0.0%',
      rawChange: motorinChange,
      tone: getTone(motorinChange),
      stripeColor: colors.fuelStripeMotorin,
      cardBg: colors.surface,
      cardBorder: colors.border,
      icon: 'truck-outline',
      dateLabel,
    },
    {
      name: 'Otogaz',
      price: formatCurrency(lpgAvg),
      change: formatChange(lpgChange),
      changePct: lpgChange > 0 ? `+${lpgPct}%` : lpgChange < 0 ? `-${lpgPct}%` : '0.0%',
      rawChange: lpgChange,
      tone: getTone(lpgChange),
      stripeColor: colors.fuelStripeLpg,
      cardBg: colors.surface,
      cardBorder: colors.border,
      icon: 'fire',
      dateLabel,
    },
  ]
}

function buildCityRows(prices) {
  const avgs = computeNationalAverages(prices)

  return [...getRealPriceRows(prices)]
    .sort((first, second) => first.benzin95 - second.benzin95)
    .map((item) => ({
      name: item.city,
      price: formatCurrency(item.benzin95),
      avgDiff: avgs.benzin95 ? item.benzin95 - avgs.benzin95 : null,
    }))
}

function buildHomeTrendSeries(history) {
  const slice = history.slice(-7)

  if (slice.length < 2) {
    return []
  }

  return [
    {
      key: 'Benzin',
      color: colors.chartBenzin,
      values: slice.map((item) => item.benzin95),
      strokeWidth: 3,
      opacity: 1,
    },
    {
      key: 'Motorin',
      color: colors.chartMotorin,
      values: slice.map((item) => item.motorin),
      strokeWidth: 3,
      opacity: 1,
    },
    {
      key: 'LPG',
      color: colors.chartLpg,
      values: slice.map((item) => item.lpg),
      strokeWidth: 3,
      opacity: 1,
    },
  ]
}

function buildHistoryTrendSeries(history) {
  return [
    {
      key: 'Benzin',
      color: colors.accent,
      values: history.map((item) => item.benzin95),
      strokeWidth: 4,
    },
    {
      key: 'Motorin',
      color: colors.info,
      values: history.map((item) => item.motorin),
      strokeWidth: 3,
    },
    {
      key: 'LPG',
      color: colors.warning,
      values: history.map((item) => item.lpg),
      strokeWidth: 3,
    },
  ]
}

function sampleHistoryRecords(history, maxPoints = 12) {
  if (history.length <= maxPoints) {
    return history
  }

  const lastIndex = history.length - 1
  const indexes = new Set(
    Array.from({ length: maxPoints }, (_, index) => Math.round((index * lastIndex) / (maxPoints - 1))),
  )

  return [...indexes].sort((first, second) => first - second).map((index) => history[index])
}

function buildHistoryDomain(history) {
  if (!history.length) {
    return { min: 0, max: 1 }
  }

  const values = history.flatMap((item) => [item.benzin95, item.motorin, item.lpg])
  const min = Math.min(...values)
  const max = Math.max(...values)

  return {
    min: Math.max(0, Math.floor(min - 2)),
    max: Math.ceil(max + 2),
  }
}

function buildHistoryLabels(history) {
  if (history.length < 3) {
    return []
  }

  return [history[0], history[Math.floor(history.length / 2)], history[history.length - 1]].map((item) =>
    formatShortDate(item.date),
  )
}

function buildRecentChanges(history, priceChangeEvents = []) {
  if (priceChangeEvents.length) {
    return priceChangeEvents.slice(0, 10).map((event) => ({
      date: `${formatShortDate(event.eventAt)} ${formatSignalTime(event.eventAt)}`,
      tag: event.fuel,
      value: `${event.diff >= 0 ? '+' : ''}${event.diff.toFixed(2)} TL`,
      desc: `${event.city}: ${formatCurrency(event.oldPrice)} -> ${formatCurrency(event.newPrice)}`,
      tone: event.direction === 'increase' ? 'up' : 'down',
    }))
  }

  const latest = [...history].reverse().slice(0, 3)

  return latest.map((item) => {
    const changes = [
      { tag: 'Benzin', value: item.benzinChange },
      { tag: 'Motorin', value: item.motorinChange },
      { tag: 'LPG', value: item.lpgChange },
    ]
    const largest = changes.reduce((selected, change) =>
      Math.abs(change.value) > Math.abs(selected.value) ? change : selected,
    )

    return {
      date: formatLongDate(item.date),
      tag: largest.tag,
      value: `${largest.value >= 0 ? '+' : ''}${largest.value.toFixed(2)} TL`,
      desc:
        largest.value > 0
          ? 'Pompa fiyatı güncellendi.'
          : largest.value < 0
            ? 'İndirim pompa fiyatlarına yansıdı.'
            : 'Gün içi değişim kaydı.',
      tone: largest.value > 0 ? 'up' : 'down',
    }
  })
}

function buildHistoryMetrics(history) {
  if (!history.length) {
    return []
  }

  const latest = history[history.length - 1]
  const lowestBenzin = history.reduce(
    (selected, item) => (item.benzin95 < selected.benzin95 ? item : selected),
    latest,
  )

  return [
    {
      label: 'En Dusuk Benzin',
      value: formatCurrency(lowestBenzin.benzin95),
      icon: 'calendar-month',
      tone: 'accent',
    },
    {
      label: 'Son Benzin',
      value: formatCurrency(latest.benzin95),
      icon: 'gas-station',
      tone: 'info',
    },
  ]
}

export function buildHistoryView(history, periodDays, selectedFuelKey = 'benzin95') {
  const deduped = deduplicateHistoryRecords(history)
  const selectedHistory = periodDays === 'all' ? deduped : deduped.slice(-periodDays)
  const chartHistory = sampleHistoryRecords(selectedHistory, periodDays === 7 ? 7 : periodDays === 30 ? 15 : 20)

  const fuelKey = selectedFuelKey === 'motorin' ? 'motorin' : selectedFuelKey === 'lpg' ? 'lpg' : 'benzin95'
  const fuelName = fuelKey === 'motorin' ? 'Motorin' : fuelKey === 'lpg' ? 'LPG' : 'Benzin 95'

  const fuelValues = selectedHistory.map((item) => ({
    date: item.date,
    shortDate: formatShortDate(item.date),
    price: Number(item[fuelKey]) || 0,
    change: Number(item[`${fuelKey === 'benzin95' ? 'benzin' : fuelKey}Change`]) || 0,
  }))

  const validPrices = fuelValues.map((v) => v.price).filter((p) => p > 0)
  const minPrice = validPrices.length ? Math.min(...validPrices) : 0
  const maxPrice = validPrices.length ? Math.max(...validPrices) : 0
  const avgPrice = validPrices.length ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0
  const firstPrice = validPrices[0] ?? 0
  const latestPrice = validPrices[validPrices.length - 1] ?? 0
  const periodDiff = latestPrice - firstPrice
  const periodDiffPct = firstPrice > 0 ? (periodDiff / firstPrice) * 100 : 0

  const minItem = fuelValues.find((v) => v.price === minPrice)
  const maxItem = fuelValues.find((v) => v.price === maxPrice)

  return {
    chartDomain: buildHistoryDomain(selectedHistory),
    chartLabels: buildHistoryLabels(chartHistory),
    metrics: buildHistoryMetrics(selectedHistory),
    trendSeries: buildHistoryTrendSeries(chartHistory),
    selectedFuelKey: fuelKey,
    fuelName,
    fuelValues,
    minPrice,
    maxPrice,
    avgPrice,
    firstPrice,
    latestPrice,
    periodDiff,
    periodDiffPct,
    minDate: minItem?.date ? formatShortDate(minItem.date) : '',
    maxDate: maxItem?.date ? formatShortDate(maxItem.date) : '',
  }
}

function buildFuelData({
  prices,
  history,
  source,
  error,
  marketSignal = null,
  priceChangeEvents = [],
  refreshRequest = null,
  syncedAt = new Date(),
}) {
  const realPrices = getRealPriceRows(prices)
  const cityRows = buildCityRows(prices)
  const sonKontrol = buildSonKontrolMeta(realPrices, syncedAt)

  return {
    bestCity: cityRows[0] ?? null,
    cities: cityRows,
    currentDateLabel: formatTodayLabel(),
    error,
    history,
    historyChartDomain: buildHistoryDomain(history),
    historyChartLabels: buildHistoryLabels(history),
    historyMetrics: buildHistoryMetrics(history),
    historyTrendSeries: buildHistoryTrendSeries(history),
    homeFuels: buildHomeFuels(prices, history),
    homeTrendSeries: buildHomeTrendSeries(history),
    hasRealPrices: realPrices.length > 0,
    dataCheckStale: sonKontrol.dataCheckStale,
    lastUpdatedLabel: sonKontrol.lastUpdatedLabel,
    lastUpdatedHm: sonKontrol.lastUpdatedHm,
    marketSignal,
    prices,
    recentChanges: buildRecentChanges(history, priceChangeEvents),
    refreshRequest,
    source,
  }
}

let lastBackendRefreshTriggerAt = 0

async function triggerBackendRefresh() {
  if (!supabase) {
    return { status: 'skipped', reason: 'supabase_not_configured' }
  }

  const now = Date.now()

  if (now - lastBackendRefreshTriggerAt < 60 * 1000) {
    return { status: 'skipped', reason: 'cooldown' }
  }

  try {
    const { data, error } = await supabase.functions.invoke('refresh-prices', {
      body: {
        source: 'mobile_refresh',
      },
    })

    if (error) {
      throw error
    }

    lastBackendRefreshTriggerAt = now

    return data ?? { status: 'queued' }
  } catch (error) {
    return {
      message: error?.message ?? 'Backend yenileme tetiklenemedi.',
      status: 'skipped',
      reason: 'edge_function_not_deployed',
    }
  }
}

async function fetchRemoteFuelData({ triggerBackend = false } = {}) {
  if (!supabase) {
    return null
  }

  const refreshRequest = triggerBackend ? await triggerBackendRefresh() : null
  const [pricesResult, historyResult, marketSignalResult, priceChangeEventsResult] = await Promise.all([
    supabase.from('fiyatlar').select('il, benzin_95, motorin, lpg, guncelleme'),
    supabase
      .from('gecmis')
      .select('tarih, benzin_95, motorin, lpg, benzin_degisim, motorin_degisim, lpg_degisim')
      .order('tarih', { ascending: false })
      .limit(365),
    supabase.from('market_signals').select(marketSignalSelect).order('calculated_at', { ascending: false }).limit(1),
    process.env.EXPO_PUBLIC_SKIP_PRICE_EVENTS === '1'
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('price_change_events')
          .select('city, fuel, old_price, new_price, diff, direction, event_at, created_at')
          .order('event_at', { ascending: false })
          .limit(100),
  ])

  if (pricesResult.error) {
    throw pricesResult.error
  }

  const remotePrices =
    pricesResult.data?.map(normalizePriceRecord).filter((row) => row !== null) ?? []
  const rawHistory = historyResult.error ? [] : historyResult.data?.map(normalizeHistoryRecord) ?? []
  const remoteHistory = deduplicateHistoryRecords(rawHistory)
  const priceChangeEvents = priceChangeEventsResult.error
    ? []
    : priceChangeEventsResult.data?.map(normalizePriceChangeEvent) ?? []

  if (!remotePrices.length) {
    return null
  }

  const latestSignalRecord = marketSignalResult.data?.[0]
  const isSignalStale = latestSignalRecord?.calculated_at
    ? Date.now() - new Date(latestSignalRecord.calculated_at).getTime() > 24 * 3600 * 1000
    : true

  const marketSignal =
    marketSignalResult.error || !latestSignalRecord || isSignalStale
      ? null
      : normalizeMarketSignalRecord(latestSignalRecord)

  return {
    history: remoteHistory,
    marketSignal,
    priceChangeEvents,
    prices: remotePrices,
    refreshRequest,
    source: 'supabase',
  }
}

function createEmptyFuelData(error) {
  return buildFuelData({
    error,
    history: [],
    marketSignal: null,
    prices: [],
    source: 'empty',
  })
}

export const emptyFuelData = createEmptyFuelData()

let fuelDataCache = null

const marketSignalSelect =
  'signal_date, direction, confidence, score, summary, brent_usd, usd_try, brent_try_index, brent_change_3d, usd_change_3d, index_change_3d, index_change_7d, signals, analysis, news_items, calculated_at'

export async function refreshMarketSignalFromRemote() {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from('market_signals')
    .select(marketSignalSelect)
    .order('calculated_at', { ascending: false })
    .limit(1)

  if (error || !data?.[0]) {
    return null
  }

  const signal = normalizeMarketSignalRecord(data[0])

  if (fuelDataCache) {
    fuelDataCache = {
      ...fuelDataCache,
      marketSignal: signal,
    }
  }

  return signal
}

export async function loadFuelData({ refresh = false, triggerBackend = refresh } = {}) {
  if (fuelDataCache && !refresh) {
    return fuelDataCache
  }

  try {
    const remoteFuelData = await fetchRemoteFuelData({ triggerBackend })

    if (remoteFuelData) {
      fuelDataCache = buildFuelData(remoteFuelData)
    } else if (!fuelDataCache || fuelDataCache.source !== 'supabase') {
      fuelDataCache = createEmptyFuelData()
    }
  } catch (error) {
    if (!fuelDataCache || fuelDataCache.source !== 'supabase') {
      fuelDataCache = createEmptyFuelData(error)
    }
  }

  return fuelDataCache
}
