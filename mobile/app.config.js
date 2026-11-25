const appJson = require('./app.json')
const { buildPluginsWithAds } = require('./adMobAppConfig.cjs')

const isProductionBuild = ['production', 'release'].includes(process.env.EAS_BUILD_PROFILE)

module.exports = () => {
  const android = {
    ...(appJson.expo.android ?? {}),
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  }

  const expo = {
    ...appJson.expo,
    android,
    plugins: buildPluginsWithAds(appJson.expo.plugins ?? [], {
      env: process.env,
      isProductionBuild,
      platform: process.env.EAS_BUILD_PLATFORM,
    }),
  }

  return { expo }
}
