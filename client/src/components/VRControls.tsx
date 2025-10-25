import { Wifi, WifiOff, Plane, Eye, EyeOff } from 'lucide-react'
import { clsx } from 'clsx'

interface VRControlsProps {
  isVRActive: boolean
  onVRToggle: () => void
  isConnected: boolean
  flightCount: number
  isLoading: boolean
  onBackToLocation?: () => void
  onRefreshFlights?: () => void
}

export function VRControls({
  isVRActive,
  onVRToggle,
  isConnected,
  flightCount,
  isLoading,
  onBackToLocation,
  onRefreshFlights,
}: VRControlsProps) {
  return (
    <div className="absolute top-4 left-4 space-y-2">
      {/* Connection Status */}
      <div className="vr-panel p-3">
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-600" />
          )}
          <span className="text-sm font-medium">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Flight Count */}
      <div className="vr-panel p-3">
        <div className="flex items-center space-x-2">
          <Plane className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">
            {flightCount} flights
          </span>
        </div>
      </div>

      {/* VR Toggle */}
      <div className="vr-panel p-3">
        <button
          onClick={onVRToggle}
          className={clsx(
            'flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors',
            isVRActive
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          )}
        >
          {isVRActive ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {isVRActive ? 'Exit VR' : 'Enter VR'}
          </span>
        </button>
      </div>

      {/* Refresh Flights Button */}
      {onRefreshFlights && (
        <div className="vr-panel p-3">
          <button
            onClick={onRefreshFlights}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plane className="w-4 h-4" />
            <span className="text-sm font-medium">Refresh Flights</span>
          </button>
        </div>
      )}

      {/* Back to Location Button */}
      {onBackToLocation && (
        <div className="vr-panel p-3">
          <button
            onClick={onBackToLocation}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="text-sm font-medium">← Back to Map</span>
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="vr-panel p-3">
          <div className="flex items-center space-x-2">
            <div className="loading-spinner w-4 h-4"></div>
            <span className="text-sm text-gray-600">Loading...</span>
          </div>
        </div>
      )}
    </div>
  )
}
