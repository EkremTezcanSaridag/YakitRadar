import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const readSource = (relativePath) => readFileSync(join(__dirname, relativePath), 'utf8')

const notificationsSource = readSource('../src/services/notifications.js')
const screenSource = readSource('../src/screens/Bildirimler.js')

// Varsayılan tercih açık olmalı: yeni kurulumda zam/indirim push'u gelsin.
assert.match(
  notificationsSource,
  /priceChangeAlerts:\s*true/,
  'defaultNotificationSettings should enable priceChangeAlerts',
)

// Eski kurulumlarda alan yoksa da bildirim kapatılmamış sayılır.
assert.match(
  screenSource,
  /settings\.priceChangeAlerts !== false/,
  'Bildirimler should treat a missing preference as enabled',
)

// Tercih backend'e kaydedilmeli, aksi halde sunucu filtreleyemez.
assert.match(
  notificationsSource,
  /price_change_alerts:\s*settings\.priceChangeAlerts !== false/,
  'syncPushRegistration must send price_change_alerts to register_push_token',
)

// Tek başına bu tercih açıksa cihaz kaydı da etkin kalmalı.
assert.match(
  notificationsSource,
  /settings\.priceChangeAlerts\s*\n?\s*\|\|\s*settings\.weeklySummary/,
  'enabled flag must include priceChangeAlerts',
)

// Kullanıcı yeni anahtarı Bildirimler ekranında görebilmeli.
assert.match(
  screenSource,
  /key:\s*'priceChangeAlerts'/,
  'Bildirimler should expose a priceChangeAlerts settings row',
)

assert.match(screenSource, /Zam \/ indirim bildirimleri/, 'row title should mention zam/indirim')

// Backend SQL'i kolonu eklemeli; RPC de yazmalı.
const sqlSource = readSource('../../backend/supabase_price_change_alerts.sql')
assert.match(
  sqlSource,
  /add column if not exists price_change_alerts boolean not null default true/,
  'migration should add price_change_alerts with a true default',
)
assert.match(
  sqlSource,
  /price_change_alerts = excluded\.price_change_alerts/,
  'register_push_token should update price_change_alerts on conflict',
)

console.log('price-change-alerts tests passed')
