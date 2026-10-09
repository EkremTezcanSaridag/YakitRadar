import AsyncStorage from '@react-native-async-storage/async-storage'

const storageKey = '@yakit-radar/favorite-cities'

export const defaultFavoriteCities = ['İstanbul', 'Ankara', 'İzmir']

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
