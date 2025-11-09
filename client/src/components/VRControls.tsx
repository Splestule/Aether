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
    <div className="absolute top-6 left-6 space-y-4 max-w-xs text-white">
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
      <div className="vr-panel px-5 py-4 space-y-3">
        <span className="compass-subtle">Active Tracks</span>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-semibold uppercase tracking-[0.35em]">
            {flightCount}
          </span>
          <Plane className="w-6 h-6 text-blue-300/80" />
        </div>
      </div>

      {/* Refresh Flights Button */}
      {onRefreshFlights && (
        <div className="vr-panel px-5 py-4 space-y-3">
          <span className="compass-subtle">Data</span>
          <button
            onClick={onRefreshFlights}
            className="vr-button w-full justify-center"
          >
            <Plane className="w-4 h-4" />
            <span>Refresh Flights</span>
          </button>
        </div>
      )}

      {/* Back to Location Button */}
      {onBackToLocation && (
        <div className="vr-panel px-5 py-4 space-y-3">
          <span className="compass-subtle">Navigate</span>
          <button
            onClick={onBackToLocation}
            className="vr-button w-full justify-center"
          >
            <span>← Back to Map</span>
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="vr-panel px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="loading-spinner w-6 h-6"></div>
            <span className="compass-subtle tracking-[0.26em]">
              Syncing Data
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
