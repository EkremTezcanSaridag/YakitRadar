import { useFuelData } from '../hooks/useFuelData'
import { useNetworkStatus } from '../context/NetworkContext'
import { resolveStatusBanner } from '../services/fuelDataViewState'
import StatusBanner from './StatusBanner'

export default function FuelDataStatusBanner() {
  const { data, refresh, refreshing } = useFuelData()
  const { isOffline } = useNetworkStatus()
  const banner = resolveStatusBanner({ isOffline, fuelData: data })

  if (!banner) {
    return null
  }

  return (
    <StatusBanner
      actionLabel={banner.actionLabel}
      busy={refreshing}
      onAction={refresh}
      text={banner.text}
      variant={banner.variant}
    />
  )
}
