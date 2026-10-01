import { colors } from '../theme'
import { supabase } from '../supabase'

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

const highlightedCities = {
  Adana: { benzin95: 63.95, motorin: 66.24, lpg: 36.08, change: -0.12, stations: 386 },
  Ankara: { benzin95: 64.1, motorin: 66.41, lpg: 36.22, change: 0.03, stations: 842 },
  Antalya: { benzin95: 64.02, motorin: 66.38, lpg: 36.18, change: -0.05, stations: 438 },
  İstanbul: { benzin95: 64.12, motorin: 66.45, lpg: 36.2, change: 0.05, stations: 1248 },
  İzmir: { benzin95: 64.08, motorin: 66.39, lpg: 36.25, change: 0.01, stations: 716 },
}

const fallbackHistory = [
  { date: '2026-09-25', benzin95: 82.11, motorin: 95.21, lpg: 35.44, benzinChange: 0, motorinChange: 0, lpgChange: 0 },
  { date: '2026-09-26', benzin95: 82.17, motorin: 95.28, lpg: 35.44, benzinChange: 0.06, motorinChange: 0.07, lpgChange: 0 },
  { date: '2026-09-27', benzin95: 82.17, motorin: 95.28, lpg: 35.44, benzinChange: 0, motorinChange: 0, lpgChange: 0 },
  { date: '2026-09-28', benzin95: 82.17, motorin: 95.28, lpg: 35.44, benzinChange: 0, motorinChange: 0, lpgChange: 0 },
  { date: '2026-09-29', benzin95: 82.17, motorin: 95.28, lpg: 35.44, benzinChange: 0, motorinChange: 0, lpgChange: 0 },
  { date: '2026-09-30', benzin95: 82.17, motorin: 95.28, lpg: 35.44, benzinChange: 0, motorinChange: 0, lpgChange: 0 },
  { date: '2026-10-01', benzin95: 86.26, motorin: 98.86, lpg: 36.89, benzinChange: 4.09, motorinChange: 3.58, lpgChange: 1.45 },
]

const fallbackUpdatedAt = '2026-07-05 10:45'
const signalToneConfig = {
  increase: {
    color: colors.danger,
    icon: 'trending-up',
    softColor: colors.dangerDark,
    title: 'Artış baskısı',
    tone: 'bad',
  },
  decrease: {
    color: colors.accent,
    icon: 'trending-down',
    softColor: colors.accentDark,
    title: 'İndirim baskısı',
    tone: 'good',
  },
  neutral: {
    color: colors.info,
    icon: 'swap-horizontal',
    softColor: '#26364F',
    title: 'Nötr sinyal',
    tone: 'flat',
  },
}
const confidenceLabels = {
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük',
}
export function buildDetailedFuelPredictions(direction, score, confidence, prices = []) {
  const isIncrease = direction === 'increase'
  const isDecrease = direction === 'decrease'

  const avgBenzin = prices.length ? (prices.reduce((s, p) => s + (p.benzin95 || 0), 0) / prices.length) : 86.26
  const avgMotorin = prices.length ? (prices.reduce((s, p) => s + (p.motorin || 0), 0) / prices.length) : 98.86
  const avgLpg = prices.length ? (prices.reduce((s, p) => s + (p.lpg || 0), 0) / prices.length) : 35.44

  const benzinHike = isIncrease ? 1.85 : isDecrease ? -1.50 : 0
  const motorinHike = isIncrease ? 5.00 : isDecrease ? -2.10 : 0

  return [
    {
      key: 'benzin95',
      fuelName: 'Benzin 95',
      icon: 'gas-station',
      direction: isIncrease ? 'increase' : isDecrease ? 'decrease' : 'neutral',
      statusText: isIncrease ? 'ZAM BEKLENİYOR' : isDecrease ? 'İNDİRİM BEKLENİYOR' : 'SABİT / DEĞİŞİM YOK',
      pillBg: isIncrease ? '#3A0D18' : isDecrease ? '#064E3B' : '#1E293B',
      pillBorder: isIncrease ? '#F43F5E' : isDecrease ? '#34D399' : '#475569',
      textColor: isIncrease ? '#F43F5E' : isDecrease ? '#34D399' : '#94A3B8',
      amountText: isIncrease ? '+1.85 ₺' : isDecrease ? '-1.50 ₺' : '0.00 ₺',
      targetDate: isIncrease ? 'Bu Gece 00:00' : isDecrease ? 'Yarın 00:00' : 'Gündemde Değişim Yok',
      currentPrice: `${avgBenzin.toFixed(2)} ₺`,
      expectedPrice: `${(avgBenzin + benzinHike).toFixed(2)} ₺`,
    },
    {
      key: 'motorin',
      fuelName: 'Motorin',
      icon: 'truck-outline',
      direction: isIncrease ? 'increase' : isDecrease ? 'decrease' : 'neutral',
      statusText: isIncrease ? 'ZAM BEKLENİYOR' : isDecrease ? 'İNDİRİM BEKLENİYOR' : 'SABİT / DEĞİŞİM YOK',
      pillBg: isIncrease ? '#3A0D18' : isDecrease ? '#064E3B' : '#1E293B',
      pillBorder: isIncrease ? '#F43F5E' : isDecrease ? '#34D399' : '#475569',
      textColor: isIncrease ? '#F43F5E' : isDecrease ? '#34D399' : '#94A3B8',
      amountText: isIncrease ? '+5.00 ₺' : isDecrease ? '-2.10 ₺' : '0.00 ₺',
      targetDate: isIncrease ? 'Salı Günü 00:00' : isDecrease ? 'Salı Günü 00:00' : 'Gündemde Değişim Yok',
      currentPrice: `${avgMotorin.toFixed(2)} ₺`,
      expectedPrice: `${(avgMotorin + motorinHike).toFixed(2)} ₺`,
    },
    {
      key: 'lpg',
      fuelName: 'LPG (Otogaz)',
      icon: 'fire',
      direction: 'neutral',
      statusText: 'SABİT / DEĞİŞİM YOK',
      pillBg: '#1E293B',
      pillBorder: '#475569',
      textColor: '#94A3B8',
      amountText: '0.00 ₺',
      targetDate: 'Gündemde Değişim Yok',
      currentPrice: `${avgLpg.toFixed(2)} ₺`,
      expectedPrice: `${avgLpg.toFixed(2)} ₺`,
    },
  ]
}

const fallbackMarketSignal = {
  color: signalToneConfig.increase.color,
  confidence: 'medium',
  confidenceLabel: confidenceLabels.medium,
  direction: 'increase',
  fuelPredictions: buildDetailedFuelPredictions('increase', 65, 'medium'),
  fuels: [
    { confidenceLabel: confidenceLabels.medium, direction: 'increase', fuel: 'Benzin', label: 'Artış Baskısı' },
    { confidenceLabel: confidenceLabels.medium, direction: 'increase', fuel: 'Motorin', label: 'Artış Baskısı' },
    { confidenceLabel: confidenceLabels.low, direction: 'neutral', fuel: 'LPG', label: 'Nötr' },
  ],
  icon: signalToneConfig.increase.icon,
  metrics: [
    { label: 'Haber', value: '5 başlık' },
    { label: 'Skor', value: '65' },
    { label: 'Pencere', value: '24s' },
  ],
  analysisFactors: [
    {
      detail: 'Habertürk ve politikam.com haber başlıklarında benzin ve motorine zam haberleri öne çıkıyor.',
      label: 'Güncel Haber Etkisi',
      tone: 'increase',
      value: '+65',
    },
    {
      detail: 'Son 24 saatteki haber başlıklarında zam haberleri var ancak net TL rakamı henüz belirtilmemiş.',
      label: 'Öne Çıkan Tutar',
      tone: 'neutral',
      value: 'Net Tutar Yok',
    },
  ],
  newsItems: [],
  score: 65,
  softColor: signalToneConfig.increase.softColor,
  summary: 'Son 24 saatteki haber başlıklarına göre benzin ve motorinde zam haberi öne çıkmaktadır.',
  title: signalToneConfig.increase.title,
  updatedAt: 'Bugün 22:04',
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
  return `${value.toFixed(2)} ₺`
}

function formatChange(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} ₺`
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

async function fetchUsdTryToday() {
  return fetchUsdTryForDate(new Date())
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

function getFallbackCity(name, index) {
  const known = highlightedCities[name]

  if (known) {
    return known
  }

  const safeIndex = index >= 0 ? index : 0
  const base = 64 + ((safeIndex * 7) % 37) / 100

  return {
    benzin95: base,
    motorin: base + 2.28 + ((safeIndex % 5) - 2) / 100,
    lpg: 36.05 + ((safeIndex * 3) % 26) / 100,
    change: ((safeIndex % 9) - 4) / 100,
    stations: 96 + ((safeIndex * 37) % 420),
  }
}

function createFallbackPrices() {
  return provinceNames.map((city, index) => {
    const fallback = getFallbackCity(city, index)

    return {
      city,
      benzin95: fallback.benzin95,
      motorin: fallback.motorin,
      lpg: fallback.lpg,
      change: fallback.change,
      stations: fallback.stations,
      updatedAt: fallbackUpdatedAt,
    }
  })
}

function normalizePriceRecord(record, index) {
  const city = record.il ?? record.city ?? record.name ?? provinceNames[index]
  const fallback = getFallbackCity(city, provinceNames.indexOf(city))

  return {
    city,
    benzin95: parseFuelValue(record.benzin_95 ?? record.benzin95) ?? fallback.benzin95,
    motorin: parseFuelValue(record.motorin) ?? fallback.motorin,
    lpg: parseFuelValue(record.lpg) ?? fallback.lpg,
    change: parseFuelValue(record.degisim ?? record.change) ?? fallback.change,
    stations: Number(record.istasyon ?? record.stations) || fallback.stations,
    updatedAt: record.guncelleme ?? record.updated_at ?? fallbackUpdatedAt,
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
    return fallbackMarketSignal
  }

  const direction = normalizeSignalDirection(record.direction)
  const confidence = normalizeSignalConfidence(record.confidence)
  const tone = signalToneConfig[direction]
  const rawFuelSignals = parseJsonList(record.signals)
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
        }
      })
    : fallbackMarketSignal.fuels
  const analysisFactors = rawFactors.length
    ? rawFactors.slice(0, 6).map((factor) => ({
        detail: factor.detail ?? '',
        label: factor.label ?? 'Faktör',
        tone: normalizeSignalDirection(factor.tone),
        value: factor.value ?? '--',
      }))
    : fallbackMarketSignal.analysisFactors
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
    summary: record.summary ?? fallbackMarketSignal.summary,
    title: tone.title,
    updatedAt: formatSignalTime(record.calculated_at ?? record.signal_date),
  }
}

function mergePricesWithFallback(records) {
  const incomingByCity = new Map(records.map((record) => [record.city, record]))

  return provinceNames.map((city, index) => {
    const incoming = incomingByCity.get(city)

    if (incoming) {
      return incoming
    }

    const fallback = getFallbackCity(city, index)

    return {
      city,
      benzin95: fallback.benzin95,
      motorin: fallback.motorin,
      lpg: fallback.lpg,
      change: fallback.change,
      stations: fallback.stations,
      updatedAt: fallbackUpdatedAt,
    }
  })
}

function average(values) {
  const validValues = values.filter((value) => Number.isFinite(value))

  if (!validValues.length) {
    return 0
  }

  return validValues.reduce((total, value) => total + value, 0) / validValues.length
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
  const benzinChange = latestHistory?.benzinChange ?? -0.45
  const motorinChange = latestHistory?.motorinChange ?? 0.12
  const lpgChange = latestHistory?.lpgChange ?? 0

  return [
    {
      name: 'Benzin 95',
      price: formatCurrency(average(prices.map((item) => item.benzin95))),
      change: formatChange(benzinChange),
      tone: getTone(benzinChange),
      badgeColor: '#4B7FC8',
    },
    {
      name: 'Motorin',
      price: formatCurrency(average(prices.map((item) => item.motorin))),
      change: formatChange(motorinChange),
      tone: getTone(motorinChange),
      badgeColor: '#60758F',
    },
    {
      name: 'LPG',
      price: formatCurrency(average(prices.map((item) => item.lpg))),
      change: formatChange(lpgChange),
      tone: getTone(lpgChange),
      badgeColor: colors.warning,
    },
  ]
}

function buildCityRows(prices) {
  return [...prices]
    .sort((first, second) => first.benzin95 - second.benzin95)
    .map((item) => ({
      name: item.city,
      price: formatCurrency(item.benzin95),
      change: formatChange(item.change),
      stations: formatStationCount(item.stations),
    }))
}

function buildHomeTrendSeries(history, prices = []) {
  const avgBenzin = average(prices.map((item) => item.benzin95)) || 86.26
  const avgMotorin = average(prices.map((item) => item.motorin)) || 98.86
  const avgLpg = average(prices.map((item) => item.lpg)) || 35.44

  const benzinVals = [
    Number((avgBenzin - 1.40).toFixed(2)),
    Number((avgBenzin - 0.90).toFixed(2)),
    Number((avgBenzin - 0.90).toFixed(2)),
    Number((avgBenzin - 0.50).toFixed(2)),
    Number((avgBenzin - 0.20).toFixed(2)),
    Number((avgBenzin - 0.20).toFixed(2)),
    Number(avgBenzin.toFixed(2)),
  ]

  const motorinVals = [
    Number((avgMotorin - 2.80).toFixed(2)),
    Number((avgMotorin - 2.10).toFixed(2)),
    Number((avgMotorin - 1.60).toFixed(2)),
    Number((avgMotorin - 1.20).toFixed(2)),
    Number((avgMotorin - 0.40).toFixed(2)),
    Number((avgMotorin - 0.40).toFixed(2)),
    Number(avgMotorin.toFixed(2)),
  ]

  const lpgVals = [
    Number((avgLpg - 0.45).toFixed(2)),
    Number((avgLpg - 0.45).toFixed(2)),
    Number((avgLpg - 0.25).toFixed(2)),
    Number((avgLpg - 0.15).toFixed(2)),
    Number((avgLpg - 0.15).toFixed(2)),
    Number(avgLpg.toFixed(2)),
    Number(avgLpg.toFixed(2)),
  ]

  return [
    {
      key: 'Benzin',
      color: colors.accent,
      values: benzinVals,
      strokeWidth: 3,
      opacity: 1,
    },
    {
      key: 'Motorin',
      color: colors.warning,
      values: motorinVals,
      strokeWidth: 3,
      opacity: 1,
    },
    {
      key: 'LPG',
      color: colors.purpleGlow,
      values: lpgVals,
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
    return ['13 Şub', '28 Şub', '15 Mar']
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
  marketSignal = fallbackMarketSignal,
  priceChangeEvents = [],
  refreshRequest = null,
  syncedAt = new Date(),
}) {
  const cityRows = buildCityRows(prices)

  return {
    bestCity: cityRows[0],
    cities: cityRows,
    currentDateLabel: formatTodayLabel(),
    error,
    history,
    historyChartDomain: buildHistoryDomain(history),
    historyChartLabels: buildHistoryLabels(history),
    historyMetrics: buildHistoryMetrics(history),
    historyTrendSeries: buildHistoryTrendSeries(history),
    homeFuels: buildHomeFuels(prices, history),
    homeTrendSeries: buildHomeTrendSeries(history, prices),
    lastUpdatedLabel: formatSyncTime(syncedAt),
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
      .order('tarih', { ascending: true })
      .limit(365),
    supabase
      .from('market_signals')
      .select(
        'signal_date, direction, confidence, score, summary, brent_usd, usd_try, brent_try_index, brent_change_3d, usd_change_3d, index_change_3d, index_change_7d, signals, analysis, news_items, calculated_at',
      )
      .order('calculated_at', { ascending: false })
      .limit(1),
    supabase
      .from('price_change_events')
      .select('city, fuel, old_price, new_price, diff, direction, event_at, created_at')
      .order('event_at', { ascending: false })
      .limit(100),
  ])

  if (pricesResult.error) {
    throw pricesResult.error
  }

  const remotePrices = pricesResult.data?.map(normalizePriceRecord) ?? []
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
      ? fallbackMarketSignal
      : normalizeMarketSignalRecord(latestSignalRecord)

  return {
    history: remoteHistory.length >= 2 ? remoteHistory : fallbackHistory,
    marketSignal,
    priceChangeEvents,
    prices: mergePricesWithFallback(remotePrices),
    refreshRequest,
    source: 'supabase',
  }
}

const fallbackFuelData = buildFuelData({
  history: fallbackHistory,
  prices: createFallbackPrices(),
  source: 'fallback',
})

function createFallbackFuelData(error) {
  return buildFuelData({
    error,
    history: fallbackHistory,
    prices: createFallbackPrices(),
    source: 'fallback',
  })
}

let fuelDataCache = null

export async function loadFuelData({ refresh = false, triggerBackend = refresh } = {}) {
  if (fuelDataCache && !refresh) {
    return fuelDataCache
  }

  try {
    const remoteFuelData = await fetchRemoteFuelData({ triggerBackend })

    fuelDataCache = remoteFuelData ? buildFuelData(remoteFuelData) : createFallbackFuelData()
  } catch (error) {
    fuelDataCache = createFallbackFuelData(error)
  }

  return fuelDataCache
}

export { fallbackFuelData }
