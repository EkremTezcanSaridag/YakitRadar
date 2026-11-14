#!/usr/bin/env node
/**
 * Play Store / EAS ön kontrolü.
 *
 * Kullanım:
 *   npm run release:preflight
 *   npm run release:preflight -- --production
 *
 * --production: yayın için zorunlu AdMob uygulama kimliklerini ve gizlilik URL'sini hata olarak işaretler.
 *
 * Not: EAS ortam değişkenleri (dashboard) yerelde görünmez; burada yalnızca kabuk/CI ortamı kontrol edilir.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(mobileRoot, '..')

const production = process.argv.includes('--production')
const results = []

function check(level, title, detail = '') {
  results.push({ level, title, detail })
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(mobileRoot, relativePath), 'utf8'))
}

function env(name) {
  return String(process.env[name] ?? '').trim()
}

function requireEnv(name, { level = 'warn', hint = '' } = {}) {
  if (env(name)) {
    check('ok', `${name} tanımlı`)
    return
  }
  check(level, `${name} eksik`, hint)
}

let appJson
let packageJson
let easJson

try {
  appJson = readJson('app.json')
  packageJson = readJson('package.json')
  easJson = readJson('eas.json')
} catch (error) {
  console.error('app.json / package.json / eas.json okunamadı:', error.message)
  process.exit(1)
}

const expo = appJson.expo ?? {}
const android = expo.android ?? {}

// --- Sürüm ve kimlik ---
if (expo.version === packageJson.version) {
  check('ok', `Sürüm senkron: ${expo.version}`)
} else {
  check('error', 'Sürüm uyuşmuyor', `app.json=${expo.version} package.json=${packageJson.version}`)
}

if (android.package) {
  check('ok', `Paket adı: ${android.package}`)
} else {
  check('error', 'android.package tanımsız')
}

if (Number.isInteger(android.versionCode) && android.versionCode > 0) {
  check('ok', `versionCode: ${android.versionCode}`)
} else {
  check('error', 'android.versionCode geçersiz')
}

if (expo.extra?.eas?.projectId) {
  check('ok', 'EAS projectId tanımlı')
} else {
  check('error', 'extra.eas.projectId eksik', 'eas init çalıştırın')
}

// --- google-services.json ---
const googleServicesPath = join(mobileRoot, 'google-services.json')
if (!existsSync(googleServicesPath)) {
  check('error', 'google-services.json yok', 'FCM/push için gerekli')
} else {
  try {
    const googleServices = JSON.parse(readFileSync(googleServicesPath, 'utf8'))
    const packageName = googleServices.client?.[0]?.client_info?.android_client_info?.package_name
    if (packageName === android.package) {
      check('ok', `google-services.json paketi eşleşiyor: ${packageName}`)
    } else {
      check('error', 'google-services.json paket adı uyuşmuyor', `dosya=${packageName} app.json=${android.package}`)
    }
  } catch (error) {
    check('error', 'google-services.json okunamadı', error.message)
  }
}

// --- İzinler ---
const permissions = new Set(android.permissions ?? [])
const blocked = new Set(android.blockedPermissions ?? [])

for (const required of ['POST_NOTIFICATIONS', 'ACCESS_COARSE_LOCATION']) {
  check(permissions.has(required) ? 'ok' : 'error', `İzin: ${required}`)
}

for (const forbidden of ['ACCESS_FINE_LOCATION', 'ACCESS_BACKGROUND_LOCATION']) {
  check(blocked.has(forbidden) ? 'ok' : 'warn', `Engellenen izin: ${forbidden}`)
}

// --- EAS profilleri ---
const previewType = easJson.build?.preview?.android?.buildType
const productionType = easJson.build?.production?.android?.buildType
check(previewType === 'apk' ? 'ok' : 'warn', `preview buildType: ${previewType ?? 'tanımsız'}`, 'APK beklenir')
check(
  productionType === 'app-bundle' ? 'ok' : 'error',
  `production buildType: ${productionType ?? 'tanımsız'}`,
  'Play Store için app-bundle gerekir',
)

if (easJson.build?.production?.autoIncrement === true) {
  check('ok', 'production autoIncrement açık')
} else {
  check('warn', 'production autoIncrement kapalı', 'versionCode elle artırılmalı')
}

// --- Gizlilik sayfası ---
if (existsSync(join(repoRoot, 'docs', 'index.html'))) {
  check('ok', 'docs/index.html mevcut (GitHub Pages)')
} else {
  check('warn', 'docs/index.html yok', 'Play gizlilik URL’si için gerekli')
}

// --- Ortam değişkenleri ---
requireEnv('EXPO_PUBLIC_SUPABASE_URL', { hint: 'EAS preview/production ortamına ekleyin' })
requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', { hint: 'EAS preview/production ortamına ekleyin' })
requireEnv('EXPO_PUBLIC_PRIVACY_POLICY_URL', {
  level: production ? 'error' : 'warn',
  hint: 'Play mağaza listesi için zorunlu',
})
requireEnv('ADMOB_ANDROID_APP_ID', {
  level: production ? 'error' : 'warn',
  hint: 'Production build bu değer olmadan durur',
})
requireEnv('ADMOB_IOS_APP_ID', {
  level: production ? 'error' : 'warn',
  hint: 'Production build bu değer olmadan durur',
})
requireEnv('EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID', {
  level: 'warn',
  hint: 'Yoksa reklamlar kapalı kalır',
})

// --- Rapor ---
const icons = { ok: '✅', warn: '⚠️ ', error: '❌' }
const errors = results.filter((r) => r.level === 'error').length
const warnings = results.filter((r) => r.level === 'warn').length

console.log(`\nYakıt Radar — yayın ön kontrolü (${production ? 'production' : 'preview'})\n`)
for (const item of results) {
  const detail = item.detail ? ` — ${item.detail}` : ''
  console.log(`${icons[item.level]} ${item.title}${detail}`)
}
console.log(`\nÖzet: ${results.length - errors - warnings} tamam, ${warnings} uyarı, ${errors} hata`)
console.log('EAS ortam değişkenleri yerelde görünmez; Expo dashboard → Environment variables ile doğrulayın.\n')

process.exit(errors > 0 ? 1 : 0)
