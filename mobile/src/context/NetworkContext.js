import { createContext, useContext, useEffect, useRef, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'

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
    NetInfo.fetch().then((state) => {
      setIsOffline(computeOffline(state))
    })

    return NetInfo.addEventListener((state) => {
      setIsOffline(computeOffline(state))
    })
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
