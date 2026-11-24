import { useFuelData } from '../hooks/useFuelData'
import { useNetworkStatus } from '../context/NetworkContext'
import { resolveStatusBanner } from '../services/fuelDataViewState'
import StatusBanner from './StatusBanner'

export default function FuelDataStatusBanner() {
  const { data, refresh, refreshing, autoRefreshing } = useFuelData()
  const { isOffline } = useNetworkStatus()
  const busy = Boolean(refreshing || autoRefreshing)
  const banner = resolveStatusBanner({ isOffline, fuelData: data, refreshing: busy })

  if (!banner) {
    return null
  }

  return (
    <StatusBanner
      actionLabel={banner.actionLabel}
      busy={busy}
      onAction={refresh}
      text={banner.text}
      variant={banner.variant}
    />
  )
}
