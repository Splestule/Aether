import { Plane } from "lucide-react";

interface VRControlsProps {
  isVRActive: boolean;
  onVRToggle: () => void; // Kept for compatibility but not used
  isConnected?: boolean; // Optional, not currently displayed
  flightCount: number;
  isLoading: boolean;
  onBackToLocation?: () => void;
  onRefreshFlights?: () => void;
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
    <div className="absolute top-6 left-6 flex flex-col gap-4 text-white">
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
      <button className="vr-button justify-center cursor-default hover:bg-[rgba(26,26,26,0.92)] hover:border-white/60 hover:text-white">
        <span className="compass-subtle tracking-[0.24em]">Active Tracks</span>
        <span
          className="text-base font-semibold uppercase tracking-[0.24em]"
          style={{ marginLeft: "0.5rem", marginRight: "-0.3rem" }}
        >
          {flightCount}
        </span>
        <Plane className="w-4 h-4 text-blue-300/80" />
      </button>

      {/* Refresh Flights Button */}
      {onRefreshFlights && (
        <button onClick={onRefreshFlights} className="vr-button justify-center">
          <Plane className="w-4 h-4" />
          <span>Refresh Flights</span>
        </button>
      )}

      {/* Back to Location Button */}
      {onBackToLocation && (
        <button onClick={onBackToLocation} className="vr-button justify-center">
          <span>← Back to Map</span>
        </button>
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
  );
}
