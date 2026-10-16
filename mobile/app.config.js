const appJson = require('./app.json')
const { buildPluginsWithAds } = require('./adMobAppConfig.cjs')

const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production'

module.exports = () => {
  const expo = {
    ...appJson.expo,
    plugins: buildPluginsWithAds(appJson.expo.plugins ?? [], {
      env: process.env,
      isProductionBuild,
    }),
  }

  return { expo }
}
