import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo } from 'react-native'
import { useReconnectEffect } from '../context/NetworkContext'
import { pushToast } from '../components/toastController'
import { checkAndTriggerCustomAlerts } from '../services/customAlerts'
import { emptyFuelData, getRealPriceRows, loadFuelData, refreshMarketSignalFromRemote } from '../services/fuelData'
import { scheduleWeeklySummaryNotification } from '../services/notifications'
import { logError } from '../utils/logger'

const FuelDataContext = createContext(null)

function triggerAlertsAndSchedule(freshData) {
  if (getRealPriceRows(freshData?.prices).length) {
    scheduleWeeklySummaryNotification(freshData.prices).catch((error) => logError('fuel.weeklySummary', error))
    checkAndTriggerCustomAlerts(freshData.prices, freshData.marketSignal).catch((error) => logError('fuel.customAlerts', error))
  }
}

function useFuelDataState() {
  const followUpTimerRef = useRef(null)
  const mountedRef = useRef(true)
  const hadRealDataRef = useRef(false)
  const [state, setState] = useState({
    data: emptyFuelData,
    loading: true,
    refreshing: false,
    marketSignalRefreshing: false,
  })

  const refresh = useCallback(async ({ userInitiated = true } = {}) => {
    setState((current) => ({
      ...current,
      refreshing: true,
    }))

    const previousHadData = hadRealDataRef.current
    const data = await loadFuelData({ refresh: true })

    setState((current) => ({
      ...current,
      data,
      loading: false,
      refreshing: false,
    }))

    hadRealDataRef.current = Boolean(data?.hasRealPrices)

    if (userInitiated) {
      if (previousHadData && data.networkFetchFailed) {
        pushToast({
          type: 'error',
          message: 'Yenilenemedi. Son kayıtlı fiyatlar gösteriliyor.',
        })
      } else if (data.hasRealPrices && !data.networkFetchFailed) {
        pushToast({
          type: 'success',
          message: 'Fiyatlar güncellendi',
        })
      }
    }

    triggerAlertsAndSchedule(data)

    if (data.refreshRequest?.status === 'queued') {
      if (followUpTimerRef.current) {
        clearTimeout(followUpTimerRef.current)
      }

      followUpTimerRef.current = setTimeout(async () => {
        const nextData = await loadFuelData({ refresh: true, triggerBackend: false })

        if (!mountedRef.current) {
          return
        }

        setState((current) => ({
          ...current,
          data: nextData,
          loading: false,
          refreshing: false,
        }))
        hadRealDataRef.current = Boolean(nextData?.hasRealPrices)
        triggerAlertsAndSchedule(nextData)
      }, 45 * 1000)
    }

    return data
  }, [])

  const refreshMarketSignal = useCallback(async () => {
    setState((current) => ({
      ...current,
      marketSignalRefreshing: true,
    }))

    const signal = await refreshMarketSignalFromRemote()

    if (!mountedRef.current) {
      return signal
    }

    setState((current) => ({
      ...current,
      data: {
        ...current.data,
        marketSignal: signal,
      },
      marketSignalRefreshing: false,
    }))

    return signal
  }, [])

  useEffect(() => {
    let isMounted = true
    mountedRef.current = true

    async function bootstrap() {
      const cached = await loadFuelData({ refresh: false })

      if (isMounted && cached?.hasRealPrices) {
        hadRealDataRef.current = true
        setState((current) => ({
          ...current,
          data: cached,
          loading: false,
        }))
      }

      const data = await loadFuelData({ refresh: true, triggerBackend: true })

      if (!isMounted) {
        return
      }

      hadRealDataRef.current = Boolean(data?.hasRealPrices)
      setState((current) => ({
        ...current,
        data,
        loading: false,
        refreshing: false,
      }))

      if (data.hasRealPrices) {
        AccessibilityInfo.announceForAccessibility('Fiyatlar yüklendi')
      }

      triggerAlertsAndSchedule(data)
    }

    bootstrap()

    return () => {
      isMounted = false
      mountedRef.current = false

      if (followUpTimerRef.current) {
        clearTimeout(followUpTimerRef.current)
      }
    }
  }, [])

  const reconnectRefresh = useCallback(() => {
    refresh({ userInitiated: false }).then((data) => {
      if (data?.hasRealPrices && !data.networkFetchFailed) {
        pushToast({
          type: 'success',
          message: 'Bağlantı geri geldi',
        })
      }
    })
  }, [refresh])

  useReconnectEffect(reconnectRefresh)

  return {
    ...state,
    refresh: () => refresh({ userInitiated: true }),
    refreshMarketSignal,
  }
}

export function FuelDataProvider({ children }) {
  const value = useFuelDataState()
  return <FuelDataContext.Provider value={value}>{children}</FuelDataContext.Provider>
}

export function useFuelData() {
  const ctx = useContext(FuelDataContext)
  if (!ctx) {
    throw new Error('useFuelData must be used within FuelDataProvider')
  }

  return ctx
}

export function useFuelDataOfflineState() {
  const { data } = useFuelData()
  const { isOffline } = useNetworkStatus()
  return { data, isOffline }
}
