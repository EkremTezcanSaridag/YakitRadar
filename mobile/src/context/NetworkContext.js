import { createContext, useContext, useEffect, useRef, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { logError } from '../utils/logger'

const NetworkContext = createContext({
  isOffline: false,
})

function computeOffline(state) {
  if (state.isConnected === false) {
    return true
  }

  if (state.isInternetReachable === false) {
    return true
  }

  return false
}

export function NetworkProvider({ children }) {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    let unsubscribe = () => {}

    try {
      NetInfo.fetch()
        .then((state) => {
          setIsOffline(computeOffline(state))
        })
        .catch((error) => {
          logError('network.fetch', error)
          setIsOffline(false)
        })

      unsubscribe = NetInfo.addEventListener((state) => {
        try {
          setIsOffline(computeOffline(state))
        } catch (error) {
          logError('network.listener', error)
          setIsOffline(false)
        }
      })
    } catch (error) {
      logError('network.setup', error)
      setIsOffline(false)
    }

    return () => {
      try {
        unsubscribe()
      } catch (error) {
        logError('network.unsubscribe', error)
      }
    }
  }, [])

  return <NetworkContext.Provider value={{ isOffline }}>{children}</NetworkContext.Provider>
}

export function useNetworkStatus() {
  return useContext(NetworkContext)
}

export function useReconnectEffect(onReconnect) {
  const { isOffline } = useNetworkStatus()
  const wasOfflineRef = useRef(isOffline)

  useEffect(() => {
    if (wasOfflineRef.current && !isOffline) {
      onReconnect()
    }

    wasOfflineRef.current = isOffline
  }, [isOffline, onReconnect])
}
