import AsyncStorage from '@react-native-async-storage/async-storage'

const storageKey = '@yakit-radar/favorite-cities'
const configuredKey = '@yakit-radar/primary-city-configured'
const locationMetaKey = '@yakit-radar/primary-city-source'

export const defaultFavoriteCities = ['İstanbul', 'Ankara', 'İzmir']
export const maxComparisonCities = 5

export async function loadFavoriteCities() {
  try {
    const stored = await AsyncStorage.getItem(storageKey)
    if (!stored) return defaultFavoriteCities
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultFavoriteCities
  } catch {
    return defaultFavoriteCities
  }
}

export async function saveFavoriteCities(cities) {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(cities))
    return cities
  } catch {
    return cities
  }
}

export async function toggleFavoriteCity(cityName) {
  const current = await loadFavoriteCities()
  let next = []
  if (current.includes(cityName)) {
    next = current.filter((c) => c !== cityName)
  } else {
    next = [...current, cityName]
  }
  await saveFavoriteCities(next)
  return next
}

/** Hero şehir = listenin ilk elemanı; seçim kalıcı olarak AsyncStorage'a yazılır. */
export async function setPrimaryCity(cityName) {
  const current = await loadFavoriteCities()
  const rest = current.filter((city) => city !== cityName)
  const next = [cityName, ...rest]
  await saveFavoriteCities(next)
  return next
}

export async function hasUserConfiguredPrimaryCity() {
  try {
    return (await AsyncStorage.getItem(configuredKey)) === '1'
  } catch {
    return false
  }
}

export async function loadLocationCityMeta() {
  try {
    const raw = await AsyncStorage.getItem(locationMetaKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.source === 'location' && parsed?.city) {
      return { source: 'location', city: parsed.city }
    }
    return null
  } catch {
    return null
  }
}

async function persistLocationMeta(cityName) {
  await AsyncStorage.setItem(locationMetaKey, JSON.stringify({ source: 'location', city: cityName }))
}

export async function clearLocationCityMeta() {
  try {
    await AsyncStorage.removeItem(locationMetaKey)
  } catch {
    // ignore
  }
}

/** İlk kurulum veya konumla seçim; hero şehir kaydı. */
export async function markPrimaryCityConfigured(cityName, source = 'manual') {
  const next = await setPrimaryCity(cityName)
  await AsyncStorage.setItem(configuredKey, '1')
  if (source === 'location') {
    await persistLocationMeta(cityName)
  } else {
    await clearLocationCityMeta()
  }
  return next
}

/** Kullanıcı şehir seçiciden değiştirdiğinde. */
export async function setPrimaryCityManual(cityName) {
  await clearLocationCityMeta()
  const next = await setPrimaryCity(cityName)
  await AsyncStorage.setItem(configuredKey, '1')
  return next
}

export async function removeComparisonCity(cityName) {
  const current = await loadFavoriteCities()
  if (!current.length || current[0] === cityName) {
    return current
  }
  const next = current.filter((city) => city !== cityName)
  await saveFavoriteCities(next)
  return next
}

export async function moveComparisonCity(cityName, direction) {
  const current = await loadFavoriteCities()
  const index = current.indexOf(cityName)
  if (index < 0) {
    return current
  }
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 1 || targetIndex >= current.length) {
    return current
  }
  const next = [...current]
  const [item] = next.splice(index, 1)
  next.splice(targetIndex, 0, item)
  await saveFavoriteCities(next)
  return next
}

export async function addComparisonCity(cityName) {
  const current = await loadFavoriteCities()
  if (current.includes(cityName)) {
    return current
  }
  if (current.length >= maxComparisonCities) {
    return current
  }
  const next = [...current, cityName]
  await saveFavoriteCities(next)
  return next
}
