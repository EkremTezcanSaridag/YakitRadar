const ADMOB_PLUGIN_NAME = 'react-native-google-mobile-ads'
const BUILD_PROPERTIES_PLUGIN = 'expo-build-properties'

/** Google'ın dokümantasyonundaki herkese açık örnek app ID'leri; yalnız preview/yerel yedek. */
const GOOGLE_SAMPLE_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713'
const GOOGLE_SAMPLE_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511'

const ADMOB_PROGUARD_RULES =
  '-keep class com.google.android.gms.internal.consent_sdk.** { *; }'

function resolveAdMobAppIdsFromEnv(env = process.env) {
  return {
    androidAppId: env.ADMOB_ANDROID_APP_ID?.trim() || '',
    iosAppId: env.ADMOB_IOS_APP_ID?.trim() || '',
  }
}

function resolveAdMobAppIdConfig({ androidAppId, iosAppId, isProductionBuild }) {
  if (androidAppId && iosAppId) {
    return {
      androidAppId,
      iosAppId,
      usedSampleFallback: false,
    }
  }

  if (isProductionBuild) {
    throw new Error(
      'Production builds require ADMOB_ANDROID_APP_ID and ADMOB_IOS_APP_ID environment variables.',
    )
  }

  return {
    androidAppId: GOOGLE_SAMPLE_ANDROID_APP_ID,
    iosAppId: GOOGLE_SAMPLE_IOS_APP_ID,
    usedSampleFallback: true,
  }
}

function withoutAdMobPlugin(plugins) {
  return plugins.filter((entry) => {
    const pluginName = Array.isArray(entry) ? entry[0] : entry
    return pluginName !== ADMOB_PLUGIN_NAME && pluginName !== BUILD_PROPERTIES_PLUGIN
  })
}

function findAdMobPluginEntry(plugins) {
  return plugins.find((entry) => Array.isArray(entry) && entry[0] === ADMOB_PLUGIN_NAME)
}

function buildPluginsWithAds(basePlugins, { env = process.env, isProductionBuild = false, warn = console.warn } = {}) {
  const envIds = resolveAdMobAppIdsFromEnv(env)
  const resolved = resolveAdMobAppIdConfig({
    androidAppId: envIds.androidAppId,
    iosAppId: envIds.iosAppId,
    isProductionBuild,
  })

  const plugins = withoutAdMobPlugin(basePlugins)

  plugins.push([
    ADMOB_PLUGIN_NAME,
    {
      androidAppId: resolved.androidAppId,
      iosAppId: resolved.iosAppId,
      delayAppMeasurementInit: true,
    },
  ])

  plugins.push([
    BUILD_PROPERTIES_PLUGIN,
    {
      android: {
        extraProguardRules: ADMOB_PROGUARD_RULES,
      },
    },
  ])

  if (resolved.usedSampleFallback) {
    warn(
      '[app.config] AdMob app IDs missing; using Google sample app IDs for native SDK (preview/local only).',
    )
  }

  return plugins
}

module.exports = {
  ADMOB_PLUGIN_NAME,
  GOOGLE_SAMPLE_ANDROID_APP_ID,
  GOOGLE_SAMPLE_IOS_APP_ID,
  buildPluginsWithAds,
  findAdMobPluginEntry,
  resolveAdMobAppIdConfig,
  resolveAdMobAppIdsFromEnv,
}
