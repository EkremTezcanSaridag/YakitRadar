const appJson = require('./app.json')

const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production'

function resolveAdMobAppIds() {
  return {
    androidAppId: process.env.ADMOB_ANDROID_APP_ID?.trim() || '',
    iosAppId: process.env.ADMOB_IOS_APP_ID?.trim() || '',
  }
}

function withoutAdMobPlugin(plugins) {
  return plugins.filter((entry) => {
    const pluginName = Array.isArray(entry) ? entry[0] : entry
    return pluginName !== 'react-native-google-mobile-ads'
  })
}

function buildPlugins(basePlugins) {
  const { androidAppId, iosAppId } = resolveAdMobAppIds()
  const plugins = withoutAdMobPlugin(basePlugins)

  if (androidAppId && iosAppId) {
    plugins.push([
      'react-native-google-mobile-ads',
      {
        androidAppId,
        iosAppId,
        delayAppMeasurementInit: true,
      },
    ])

    plugins.push([
      'expo-build-properties',
      {
        android: {
          extraProguardRules: '-keep class com.google.android.gms.internal.consent_sdk.** { *; }',
        },
      },
    ])

    return plugins
  }

  if (isProductionBuild) {
    throw new Error(
      'Production builds require ADMOB_ANDROID_APP_ID and ADMOB_IOS_APP_ID environment variables.',
    )
  }

  console.warn('[app.config] AdMob app IDs are missing; native AdMob plugin omitted for this build.')

  return plugins
}

module.exports = () => {
  const expo = { ...appJson.expo, plugins: buildPlugins(appJson.expo.plugins ?? []) }

  return { expo }
}
