import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shouldShowNotificationPermissionPrompt } from '../src/services/notificationPermissionPrompt.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const readSource = (relativePath) => readFileSync(join(__dirname, relativePath), 'utf8')

// Policy matrix: the pre-permission prompt must appear at most once and never
// when the OS will not show a dialog or the user already made a choice.
assert.equal(
  shouldShowNotificationPermissionPrompt({ platform: 'android' }),
  true,
  'fresh Android install should show the rationale prompt',
)

assert.equal(
  shouldShowNotificationPermissionPrompt({ platform: 'ios' }),
  true,
  'fresh iOS install should show the rationale prompt',
)

assert.equal(
  shouldShowNotificationPermissionPrompt({ platform: 'android', seen: true }),
  false,
  'prompt must not repeat after the user has seen it',
)

assert.equal(
  shouldShowNotificationPermissionPrompt({ platform: 'android', granted: true }),
  false,
  'prompt must not show when notifications are already granted',
)

assert.equal(
  shouldShowNotificationPermissionPrompt({ platform: 'android', canAskAgain: false }),
  false,
  'prompt must not show when the OS can no longer ask',
)

assert.equal(
  shouldShowNotificationPermissionPrompt({ platform: 'web' }),
  false,
  'web build must not show a native permission prompt',
)

const appSource = readSource('../App.js')

assert.match(
  appSource,
  /import NotificationPermissionPrompt from '\.\/src\/components\/NotificationPermissionPrompt'/,
  'App.js must import the pre-permission prompt component',
)

assert.match(
  appSource,
  /<NotificationPermissionPrompt[\s\S]*?onAccept=\{enableNotifications\}[\s\S]*?onDecline=\{dismissPermissionPrompt\}/,
  'prompt must be wired to accept and decline handlers',
)

assert.match(
  appSource,
  /if \(bootState !== 'app'\) \{[\s\S]*?return undefined/,
  'prompt check must wait until onboarding is complete',
)

assert.match(
  appSource,
  /getNotificationPermissionSnapshot\(\)/,
  'App.js must read the current permission before prompting',
)

assert.match(
  appSource,
  /saveNotificationPermissionPromptSeen\(\)/,
  'App.js must persist that the prompt was shown',
)

assert.match(
  appSource,
  /requestNotificationAccess\(settings, \{[\s\S]*?trackedCities,[\s\S]*?\}\)/,
  'accepting the prompt must register the notification access with the user cities',
)

assert.match(
  appSource,
  /const trackedCities = await loadFavoriteCities\(\)/,
  'startup push sync must use the user favorite cities, not a hardcoded list',
)

const bildirimlerSource = readSource('../src/screens/Bildirimler.js')

assert.match(
  bildirimlerSource,
  /trackedCities: favoriteCities\.length \? favoriteCities : cityChips/,
  'notification settings sync must keep the user favorite cities as tracked cities',
)

const uiPreferencesSource = readSource('../src/services/uiPreferences.js')

assert.match(
  uiPreferencesSource,
  /@yakit-radar\/notification-permission-prompt-seen/,
  'seen flag must use a stable AsyncStorage key',
)

const promptSource = readSource('../src/components/NotificationPermissionPrompt.js')

assert.match(promptSource, /onPress=\{onAccept\}/, 'primary action must call onAccept')
assert.match(promptSource, /onPress=\{onDecline\}/, 'secondary action must call onDecline')
assert.match(promptSource, /Bildirimleri aç/, 'primary action needs explicit consent copy')
assert.match(promptSource, /Şimdi değil/, 'decline action must be available without pressure')
assert.match(promptSource, /accessibilityViewIsModal/, 'modal content should trap accessibility focus')
assert.equal(
  (promptSource.match(/accessibilityRole="button"/g) ?? []).length,
  2,
  'both prompt actions must expose the button accessibility role',
)

const notificationsSource = readSource('../src/services/notifications.js')

assert.match(
  notificationsSource,
  /export async function getNotificationPermissionSnapshot\(\)/,
  'notifications service must expose a light permission snapshot',
)

const snapshotBody = notificationsSource.slice(
  notificationsSource.indexOf('export async function getNotificationPermissionSnapshot()'),
  notificationsSource.indexOf('export async function syncExistingNotificationPermission'),
)

assert.match(snapshotBody, /setupNotificationChannels\(\)/, 'channel setup must run before the permission check')
assert.match(snapshotBody, /Notifications\.getPermissionsAsync\(\)/, 'snapshot must read the OS permission status')

console.log('notification-permission-prompt tests passed')
