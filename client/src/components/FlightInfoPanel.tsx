import { X, Plane, MapPin, Gauge, Navigation, Clock } from "lucide-react";
import { ProcessedFlight } from "@shared/src/types.js";
import {
  formatSpeed,
  formatAltitude,
  formatDistance,
} from "@shared/src/utils.js";
import { clsx } from "clsx";

interface FlightInfoPanelProps {
  flight: ProcessedFlight;
  onClose: () => void;
}

export function FlightInfoPanel({ flight, onClose }: FlightInfoPanelProps) {
  const formatHeading = (heading: number): string => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(heading / 45) % 8;
    return `${heading.toFixed(0)}° ${directions[index]}`;
  };

  const formatLastUpdate = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div
      className="flight-info-card"
      style={{
        position: "fixed", // Use fixed positioning for VR compatibility
        top: "16px",
        right: "16px",
        zIndex: 10000, // Ensure it appears above VR canvas
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="compass-title text-xl">Flight Details</h3>
        <button onClick={onClose} className="vr-icon-button">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Flight Info */}
        <div className="flex items-center gap-3">
          <Plane className="w-5 h-5 text-blue-300/80" />
          <div>
            <div className="text-base font-semibold uppercase tracking-[0.28em]">
              {flight.callsign}
            </div>
            <div className="compass-subtle tracking-[0.22em]">
              {flight.airline}
            </div>
          </div>
        </div>

        {/* ICAO Code */}
        <div className="text-sm">
          <span className="compass-subtle">ICAO</span>
          <span className="ml-3 font-semibold tracking-[0.24em] uppercase">
            {flight.icao24}
          </span>
        </div>

        {/* Position */}
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-white/60" />
          <div className="text-sm space-y-1">
            <div className="compass-subtle">Position</div>
            <div className="font-semibold tracking-[0.18em]">
              {flight.gps.latitude.toFixed(4)},{" "}
              {flight.gps.longitude.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Altitude */}
        <div className="flex items-center gap-3">
          <Navigation className="w-5 h-5 text-white/60" />
          <div className="text-sm">
            <div className="compass-subtle">Altitude</div>
            <div className="font-semibold tracking-[0.18em] uppercase">
              {formatAltitude(flight.gps.altitude)}
            </div>
          </div>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-3">
          <Gauge className="w-5 h-5 text-white/60" />
          <div className="text-sm">
            <div className="compass-subtle">Speed</div>
            <div className="font-semibold tracking-[0.18em] uppercase">
              {formatSpeed(flight.velocity)}
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="flex items-center gap-3">
          <Navigation className="w-5 h-5 text-white/60" />
          <div className="text-sm">
            <div className="compass-subtle">Heading</div>
            <div className="font-semibold tracking-[0.18em] uppercase">
              {formatHeading(flight.heading)}
            </div>
          </div>
        </div>

        {/* Distance */}
        <div className="text-sm">
          <span className="compass-subtle">Distance from you</span>
          <span className="ml-3 font-semibold tracking-[0.18em] uppercase">
            {formatDistance(flight.distance)}
          </span>
        </div>

        {/* Elevation */}
        <div className="text-sm">
          <span className="compass-subtle">Elevation Angle</span>
          <span className="ml-3 font-semibold tracking-[0.18em] uppercase">
            {flight.elevation.toFixed(1)}°
          </span>
        </div>

        {/* Status */}
        <div className="text-sm">
          <span className="compass-subtle">Status</span>
          <span
            className={clsx(
              "ml-3 font-semibold tracking-[0.18em] uppercase",
              flight.onGround ? "text-white/50" : "text-blue-200"
            )}
          >
            {flight.onGround ? "On Ground" : "In Flight"}
          </span>
        </div>

        {/* Last Update */}
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-white/40" />
          <div className="compass-subtle tracking-[0.22em]">
            Updated {formatLastUpdate(flight.lastUpdate)}
          </div>
        </div>
      </div>
    </div>
  );
}
