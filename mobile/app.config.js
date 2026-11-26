const appJson = require('./app.json')
const { buildPluginsWithAds } = require('./adMobAppConfig.cjs')

const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production'
const isReleaseBuild = process.env.EAS_BUILD_PROFILE === 'release'

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
      isReleaseBuild,
      platform: process.env.EAS_BUILD_PLATFORM,
    }),
  }

  return { expo }
}
