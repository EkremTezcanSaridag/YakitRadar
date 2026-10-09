import * as Location from 'expo-location'
import { provinceCenters } from './provinceCenters'
import { provinceNames } from './fuelData'

const LOCATION_TIMEOUT_MS = 8000

function normalizeProvinceKey(value) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıIİi]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .replace(/\s+/g, '')
    .trim()
}

const provinceByKey = new Map(provinceNames.map((name) => [normalizeProvinceKey(name), name]))

function matchProvinceName(candidate) {
  if (!candidate) return null
  const key = normalizeProvinceKey(candidate)
  if (provinceByKey.has(key)) return provinceByKey.get(key)
  for (const [normalized, name] of provinceByKey.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return name
    }
  }
  return null
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

export function nearestProvinceByCoordinates(latitude, longitude) {
  let nearest = provinceCenters[0]?.name ?? 'Ankara'
  let bestDistance = Infinity

  for (const center of provinceCenters) {
    const d = distanceKm(latitude, longitude, center.latitude, center.longitude)
    if (d < bestDistance) {
      bestDistance = d
      nearest = center.name
    }
  }

  return nearest
}

function matchGeocodeResults(results) {
  for (const result of results ?? []) {
    const fields = [
      result.city,
      result.subregion,
      result.region,
      result.district,
      result.name,
      result.street,
    ]
    for (const field of fields) {
      const matched = matchProvinceName(field)
      if (matched) return matched
    }
  }
  return null
}

async function getCurrentCoordinates() {
  const permission = await Location.requestForegroundPermissionsAsync()
  if (permission.status !== 'granted') {
    throw new Error('permission_denied')
  }

  const positionPromise = Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Low,
  })

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), LOCATION_TIMEOUT_MS)
  })

  const position = await Promise.race([positionPromise, timeoutPromise])
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  }
}

async function reverseGeocodeProvince(latitude, longitude) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude })
    return matchGeocodeResults(results)
  } catch {
    return null
  }
}

/** Koordinatlar sunucuya gönderilmez; yalnızca il adı döner. */
export async function resolveHomeCityFromDeviceLocation() {
  const { latitude, longitude } = await getCurrentCoordinates()
  const fromGeocode = await reverseGeocodeProvince(latitude, longitude)
  if (fromGeocode) return fromGeocode
  return nearestProvinceByCoordinates(latitude, longitude)
}
