import { useCallback, useEffect, useRef, useState } from 'react'
import { checkAndTriggerCustomAlerts } from '../services/customAlerts'
import { emptyFuelData, getRealPriceRows, loadFuelData, refreshMarketSignalFromRemote } from '../services/fuelData'
import { scheduleWeeklySummaryNotification } from '../services/notifications'

function triggerAlertsAndSchedule(freshData) {
  if (getRealPriceRows(freshData?.prices).length) {
    scheduleWeeklySummaryNotification(freshData.prices).catch(() => {})
    checkAndTriggerCustomAlerts(freshData.prices, freshData.marketSignal).catch(() => {})
  }
}

export function useFuelData() {
  const followUpTimerRef = useRef(null)
  const mountedRef = useRef(true)
  const [state, setState] = useState({
    data: emptyFuelData,
    loading: true,
    refreshing: false,
    marketSignalRefreshing: false,
  })

  const refresh = useCallback(async () => {
    setState((current) => ({
      ...current,
      refreshing: true,
    }))

    const data = await loadFuelData({ refresh: true })

    setState((current) => ({
      ...current,
      data,
      loading: false,
      refreshing: false,
    }))

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
        triggerAlertsAndSchedule(nextData)
      }, 45 * 1000)
    }
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

    loadFuelData().then((data) => {
      if (!isMounted) {
        return
      }

      setState((current) => ({
        ...current,
        data,
        loading: false,
        refreshing: false,
      }))
      triggerAlertsAndSchedule(data)
    })

    return () => {
      isMounted = false
      mountedRef.current = false

      if (followUpTimerRef.current) {
        clearTimeout(followUpTimerRef.current)
      }
    }
  }, [])

  return {
    ...state,
    refresh,
    refreshMarketSignal,
  }
}
