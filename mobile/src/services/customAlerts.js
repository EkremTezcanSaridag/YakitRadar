import AsyncStorage from '@react-native-async-storage/async-storage'

const storageKey = '@yakit-radar/custom-price-alerts'

export const alertConditions = [
  { id: 'below_price', label: 'Fiyat Düşünce', icon: 'trending-down', desc: 'Litre fiyatı belirtilen tutarın altına inince' },
  { id: 'above_price', label: 'Fiyat Yükselince', icon: 'trending-up', desc: 'Litre fiyatı belirtilen tutarı aşınca' },
  { id: 'news_hike', label: 'Zam Haberi Çıkınca', icon: 'bullhorn-outline', desc: 'Groq AI zam haberi tespit edince' },
]

export const defaultAlerts = [
  {
    id: 'default-1',
    city: 'İstanbul',
    fuelKey: 'benzin95',
    fuelTitle: 'Benzin 95',
    condition: 'below_price',
    targetValue: '70',
    isEnabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-2',
    city: 'Tüm Şehirler',
    fuelKey: 'motorin',
    fuelTitle: 'Motorin',
    condition: 'news_hike',
    targetValue: '2',
    isEnabled: true,
    createdAt: new Date().toISOString(),
  },
]

export async function loadCustomAlerts() {
  try {
    const stored = await AsyncStorage.getItem(storageKey)
    if (!stored) return defaultAlerts
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : defaultAlerts
  } catch {
    return defaultAlerts
  }
}

export async function saveCustomAlerts(alerts) {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(alerts))
    return alerts
  } catch {
    return alerts
  }
}

export async function addCustomAlert(alertData) {
  const current = await loadCustomAlerts()
  const newAlert = {
    ...alertData,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    isEnabled: true,
    createdAt: new Date().toISOString(),
  }
  const updated = [newAlert, ...current]
  await saveCustomAlerts(updated)
  return updated
}

export async function toggleCustomAlert(id) {
  const current = await loadCustomAlerts()
  const updated = current.map((item) => (item.id === id ? { ...item, isEnabled: !item.isEnabled } : item))
  await saveCustomAlerts(updated)
  return updated
}

export async function deleteCustomAlert(id) {
  const current = await loadCustomAlerts()
  const updated = current.filter((item) => item.id !== id)
  await saveCustomAlerts(updated)
  return updated
}

export function evaluateCustomAlerts(alerts, prices, marketSignal) {
  if (!Array.isArray(alerts) || alerts.length === 0) return []

  const activeAlerts = alerts.filter((a) => a.isEnabled)
  const triggered = []

  for (const alert of activeAlerts) {
    if (alert.condition === 'news_hike') {
      if (marketSignal?.direction === 'increase') {
        triggered.push({
          alert,
          message: `${marketSignal.summary ?? 'Zam beklentisi öne çıkıyor'}`,
        })
      }
    } else {
      const cityPrices = prices.find((p) => p.city === alert.city)
      if (cityPrices) {
        const currentPrice = Number(cityPrices[alert.fuelKey]) || 0
        const targetPrice = Number.parseFloat(alert.targetValue) || 0
        if (alert.condition === 'below_price' && currentPrice > 0 && currentPrice <= targetPrice) {
          triggered.push({
            alert,
            message: `${alert.city} ${alert.fuelTitle} ${currentPrice.toFixed(2)} TL (Hedef: ${targetPrice} TL)`,
          })
        } else if (alert.condition === 'above_price' && currentPrice >= targetPrice) {
          triggered.push({
            alert,
            message: `${alert.city} ${alert.fuelTitle} ${currentPrice.toFixed(2)} TL (Eşik: ${targetPrice} TL)`,
          })
        }
      }
    }
  }

  return triggered
}
