import { Plane } from 'lucide-react';
import { clsx } from 'clsx';
import { BYOKStatus } from './BYOKStatus';

interface VRControlsProps {
  flightCount: number;
  isLoading: boolean;
  onBackToLocation?: () => void;
  onRefreshFlights?: () => void;
  isRouteEnabled?: boolean;
  onToggleRoute?: () => void;
}

export function VRControls({
  flightCount,
  isLoading,
  onBackToLocation,
  onRefreshFlights,
  isRouteEnabled = false,
  onToggleRoute,
}: VRControlsProps) {
  return (
    <div className="absolute top-2 left-2 sm:top-6 sm:left-6 flex flex-col gap-2 sm:gap-4 text-white z-[9999] w-40 sm:w-64 pointer-events-auto">
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
      <button className="vr-button justify-center cursor-default hover:bg-[rgba(26,26,26,0.92)] hover:border-white/60 hover:text-white text-[10px] sm:text-[0.65rem] px-2 py-1.5 sm:px-5 sm:py-3 w-full">
        <span className="hidden sm:inline compass-subtle tracking-[0.24em] text-[0.6rem] whitespace-nowrap">
          Active Tracks
        </span>
        <Plane className="w-3 h-3 sm:w-4 sm:h-4 text-[#c6a0e8]/80 flex-shrink-0" />
        <span className="text-[10px] sm:text-base font-semibold uppercase tracking-[0.22em] sm:tracking-[0.24em] leading-none">
          {flightCount}
        </span>
      </button>

      {/* Refresh Flights Button */}
      {onRefreshFlights && (
        <button
          onClick={onRefreshFlights}
          className="vr-button justify-center text-[10px] sm:text-[0.65rem] px-2.5 py-2 sm:px-5 sm:py-3 w-full"
        >
          <Plane className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">Refresh Flights</span>
          <span className="sm:hidden whitespace-nowrap">Refresh</span>
        </button>
      )}

      {onToggleRoute && (
        <button
          type="button"
          onClick={onToggleRoute}
          className="vr-panel px-2.5 py-2 sm:px-5 sm:py-3 flex items-center justify-between text-[10px] sm:text-[0.6rem] w-full hidden"
          style={{ display: 'none' }}
        >
          <span className="compass-subtle uppercase tracking-[0.22em] text-[10px] sm:text-[0.6rem] whitespace-nowrap">
            Route Info
          </span>
          <span
            className={clsx(
              'relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors duration-300 flex-shrink-0',
              isRouteEnabled ? 'bg-white/40' : 'bg-white/25'
            )}
          >
            <span
              className={clsx(
                'absolute left-0.5 top-0.5 sm:left-1 sm:top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300',
                isRouteEnabled ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'
              )}
            />
          </span>
        </button>
      )}

      {/* Back to Location Button */}
      {onBackToLocation && (
        <button
          onClick={onBackToLocation}
          className="vr-button justify-center text-[10px] sm:text-[0.65rem] px-2.5 py-2 sm:px-5 sm:py-3 w-full"
        >
          <span className="hidden sm:inline whitespace-nowrap">← Back to Map</span>
          <span className="sm:hidden whitespace-nowrap">← Map</span>
        </button>
      )}

      {/* BYOK Status Indicator */}
      <BYOKStatus />

      {/* Loading Indicator */}
      {isLoading && (
        <div className="vr-panel px-2.5 py-2 sm:px-5 sm:py-4 w-full">
          <div className="flex items-center gap-2 sm:gap-3 justify-center">
            <div className="loading-spinner w-4 h-4 sm:w-6 sm:h-6 flex-shrink-0"></div>
            <span className="compass-subtle tracking-[0.26em] text-[10px] sm:text-[0.6rem] whitespace-nowrap">
              <span className="sm:hidden">Syncing...</span>
              <span className="hidden sm:inline">Syncing Data</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
