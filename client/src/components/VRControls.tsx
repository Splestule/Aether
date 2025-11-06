import { Plane } from 'lucide-react'

interface VRControlsProps {
  isVRActive: boolean
  onVRToggle: () => void // Kept for compatibility but not used
  isConnected?: boolean // Optional, not currently displayed
  flightCount: number
  isLoading: boolean
  onBackToLocation?: () => void
  onRefreshFlights?: () => void
}

export function VRControls({
  isVRActive: _isVRActive, // Unused but kept for compatibility
  onVRToggle: _onVRToggle, // Unused but kept for compatibility
  isConnected: _isConnected, // Unused but kept for future use
  flightCount,
  isLoading,
  onBackToLocation,
  onRefreshFlights,
}: VRControlsProps) {
  return (
    <div className="absolute top-4 left-4 space-y-2">
      {/* Connection Status - removed */}
      {/* <div className="vr-panel p-3">
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-white" />
          ) : (
            <WifiOff className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-white">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div> */}

      {/* Flight Count */}
      <div className="vr-panel p-3">
        <div className="flex items-center space-x-2">
          <Plane className="w-4 h-4 text-white" />
          <span className="text-sm font-medium text-white">
            {flightCount} flights
          </span>
        </div>
      </div>

      {/* Refresh Flights Button */}
      {onRefreshFlights && (
        <div className="vr-panel p-3">
          <button
            onClick={onRefreshFlights}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
            className="flex items-center space-x-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
            <span className="text-sm text-gray-300">Loading...</span>
          </div>
        </div>
      )}
    </div>
  )
}
