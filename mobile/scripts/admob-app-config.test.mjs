import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  GOOGLE_SAMPLE_ANDROID_APP_ID,
  buildPluginsWithAds,
  findAdMobPluginEntry,
  resolveAdMobAppIdConfig,
} = require('../adMobAppConfig.cjs')

const customAndroid = 'ca-app-pub-0000000000000000~1111111111'
const customIos = 'ca-app-pub-0000000000000000~2222222222'

const previewPlugins = buildPluginsWithAds([], {
  env: {},
  isProductionBuild: false,
  warn: () => {},
})

const admobEntry = findAdMobPluginEntry(previewPlugins)
assert.ok(admobEntry, 'react-native-google-mobile-ads plugin must be present without env IDs')
assert.equal(admobEntry[1].androidAppId, GOOGLE_SAMPLE_ANDROID_APP_ID)
assert.ok(String(admobEntry[1].androidAppId).length > 0, 'android_app_id must be non-empty')

assert.throws(
  () =>
    buildPluginsWithAds([], {
      env: {},
      isProductionBuild: true,
      warn: () => {},
    }),
  /Production builds require ADMOB_ANDROID_APP_ID/,
)

const configuredPlugins = buildPluginsWithAds([], {
  env: {
    ADMOB_ANDROID_APP_ID: customAndroid,
    ADMOB_IOS_APP_ID: customIos,
  },
  isProductionBuild: false,
  warn: () => {},
})

const configuredEntry = findAdMobPluginEntry(configuredPlugins)
assert.equal(configuredEntry[1].androidAppId, customAndroid)
assert.equal(configuredEntry[1].iosAppId, customIos)

const fromHelper = resolveAdMobAppIdConfig({
  androidAppId: customAndroid,
  iosAppId: customIos,
  isProductionBuild: true,
})
assert.equal(fromHelper.usedSampleFallback, false)

console.log('admob-app-config tests passed')
