import { useCallback, useEffect, useRef, useState } from 'react'
import { checkAndTriggerCustomAlerts } from '../services/customAlerts'
import { fallbackFuelData, loadFuelData } from '../services/fuelData'
import { scheduleWeeklySummaryNotification } from '../services/notifications'

function triggerAlertsAndSchedule(freshData) {
  if (freshData?.prices?.length) {
    scheduleWeeklySummaryNotification(freshData.prices).catch(() => {})
    checkAndTriggerCustomAlerts(freshData.prices, freshData.marketSignal).catch(() => {})
  }
}

export function useFuelData() {
  const followUpTimerRef = useRef(null)
  const mountedRef = useRef(true)
  const [state, setState] = useState({
    data: fallbackFuelData,
    loading: true,
    refreshing: false,
  })

  const refresh = useCallback(async () => {
    setState((current) => ({
      ...current,
      refreshing: true,
    }))

    const data = await loadFuelData({ refresh: true })

    setState({
      data,
      loading: false,
      refreshing: false,
    })

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

        setState({
          data: nextData,
          loading: false,
          refreshing: false,
        })
        triggerAlertsAndSchedule(nextData)
      }, 45 * 1000)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    mountedRef.current = true

    loadFuelData().then((data) => {
      if (!isMounted) {
        return
      }

      setState({
        data,
        loading: false,
        refreshing: false,
      })
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
  }
}
