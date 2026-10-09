import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:4178'
const OUT_DIR = '/opt/cursor/artifacts/screenshots'
const SUPABASE_HOST = 'phmmqamvornjwtcrbioh.supabase.co'

const priceRows = [
  {
    il: 'İstanbul',
    benzin_95: 92.01,
    motorin: 44.5,
    lpg: 28.2,
    guncelleme: '2026-10-09 20:30',
  },
  {
    il: 'Ankara',
    benzin_95: 91.5,
    motorin: 44.1,
    lpg: 27.9,
    guncelleme: '2026-10-09 20:30',
  },
]

function marketSignalRow(signals) {
  const now = new Date().toISOString()
  return {
    signal_date: '2026-10-09',
    direction: 'increase',
    confidence: 'high',
    score: 82,
    summary: 'Test harness summary — not shown in UI.',
    brent_usd: null,
    usd_try: null,
    brent_try_index: null,
    brent_change_3d: null,
    usd_change_3d: null,
    index_change_3d: null,
    index_change_7d: null,
    signals,
    analysis: {},
    news_items: [],
    calculated_at: now,
  }
}

const scenarios = [
  {
    file: 'expected-change-two-boxes.png',
    signals: [
      {
        fuel: 'Motorin',
        direction: 'increase',
        expected_amount_tl: 6.4,
        timing: 'Bu gece yarısı',
      },
      {
        fuel: 'Benzin',
        direction: 'decrease',
        expected_amount_tl: 0.96,
        timing: 'Bu gece yarısı',
      },
      {
        fuel: 'LPG',
        direction: 'neutral',
        expected_amount: 0,
      },
    ],
    expectHeading: true,
  },
  {
    file: 'expected-change-one-box.png',
    signals: [
      {
        fuel: 'Motorin',
        direction: 'increase',
        expected_amount_tl: 1.2,
        timing: 'Bu gece yarısı',
      },
    ],
    expectHeading: true,
  },
  {
    file: 'expected-change-no-boxes.png',
    signals: [
      {
        fuel: 'Motorin',
        direction: 'increase',
        expected_amount: 0.5,
      },
      {
        fuel: 'Benzin',
        direction: 'neutral',
      },
    ],
    expectHeading: false,
  },
]

async function installRoutes(page, signals) {
  await page.route(`**/${SUPABASE_HOST}/rest/v1/fiyatlar**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(priceRows),
    })
  })

  await page.route(`**/${SUPABASE_HOST}/rest/v1/gecmis**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route(`**/${SUPABASE_HOST}/rest/v1/market_signals**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([marketSignalRow(signals)]),
    })
  })

  await page.route(`**/${SUPABASE_HOST}/rest/v1/price_change_events**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const saved = []

  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await context.addInitScript(() => {
      localStorage.setItem('@yakit-radar/primary-city-configured', '1')
      localStorage.setItem('@yakit-radar/show-market-note', '1')
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (err) => errors.push(String(err)))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await installRoutes(page, scenario.signals)
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(2500)

    const heading = page.getByText('BEKLENEN DEĞİŞİM')
    if (scenario.expectHeading) {
      await heading.waitFor({ state: 'visible', timeout: 15000 })
    } else {
      await heading.waitFor({ state: 'hidden', timeout: 15000 })
    }

    const path = `${OUT_DIR}/${scenario.file}`
    await page.screenshot({ path, fullPage: true })
    saved.push(path)

    if (errors.length) {
      console.error(`Errors in ${scenario.file}:`, errors)
      process.exit(1)
    }

    await context.close()
  }

  const smokeContext = await browser.newContext()
  await smokeContext.addInitScript(() => {
    localStorage.setItem('@yakit-radar/primary-city-configured', '1')
  })
  const smokePage = await smokeContext.newPage()
  const smokeErrors = []
  smokePage.on('pageerror', (err) => smokeErrors.push(String(err)))
  smokePage.on('console', (msg) => {
    if (msg.type() === 'error') {
      smokeErrors.push(msg.text())
    }
  })
  await smokePage.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await smokePage.waitForTimeout(2000)
  for (const tab of ['Ana Sayfa', 'İller', 'Geçmiş', 'Aracım', 'Bildirimler']) {
    await smokePage.getByRole('tab', { name: tab }).click({ timeout: 15000 })
    await smokePage.waitForTimeout(500)
  }
  await smokeContext.close()
  await browser.close()

  if (smokeErrors.length) {
    console.error('Smoke errors:', smokeErrors)
    process.exit(1)
  }

  console.log('Screenshots:')
  for (const path of saved) {
    console.log(path)
  }
  console.log('OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
