export function formatTimeHmTurkey(isoValue) {
  if (!isoValue) {
    return '--:--'
  }

  const date = new Date(isoValue)

  if (Number.isNaN(date.getTime())) {
    return '--:--'
  }

  return date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

export function resolveStatusBanner({ isOffline, fuelData }) {
  if (!fuelData?.hasRealPrices) {
    return null
  }

  const timeLabel = formatTimeHmTurkey(fuelData.cacheSavedAt ?? fuelData.syncedAtIso)
  const offlineCondition = Boolean(isOffline || fuelData.networkFetchFailed)

  if (offlineCondition) {
    return {
      variant: 'offline',
      text: `İnternet yok · Son kayıtlı fiyatlar: ${timeLabel}`,
      actionLabel: 'Yenile',
    }
  }

  if (fuelData.dataCheckStale) {
    const kontrol = fuelData.lastUpdatedHm ?? timeLabel
    return {
      variant: 'stale',
      text: `Fiyatlar güncel olmayabilir · Son kontrol ${kontrol}`,
      actionLabel: 'Yenile',
    }
  }

  return null
}

export function resolveFuelEmptyState({ loading, fuelData, isOffline }) {
  if (loading || fuelData?.hasRealPrices) {
    return null
  }

  if (isOffline) {
    return {
      variant: 'offline',
      title: 'İnternet bağlantısı yok',
      message: 'Bağlantı kurulunca fiyatlar yenilenir.',
      actionLabel: 'Tekrar dene',
    }
  }

  if (fuelData?.error) {
    return {
      variant: 'error',
      title: 'Fiyatlar alınamadı',
      message: 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.',
      actionLabel: 'Tekrar dene',
    }
  }

  return {
    variant: 'empty',
    title: 'Fiyat verisi henüz yok',
    message: 'Güncel fiyatlar şu an listelenemiyor. Biraz sonra tekrar dene.',
    actionLabel: 'Tekrar dene',
  }
}

export function shouldShowFuelDataSkeleton(loading, hasRealData) {
  return Boolean(loading && !hasRealData)
}
