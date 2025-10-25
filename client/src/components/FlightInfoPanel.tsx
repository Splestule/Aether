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
    <div className="absolute top-4 right-4 flight-info-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Flight Details</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Flight Info */}
        <div className="flex items-center space-x-3">
          <Plane className="w-5 h-5 text-blue-600" />
          <div>
            <div className="font-medium text-gray-800">{flight.callsign}</div>
            <div className="text-sm text-gray-600">{flight.airline}</div>
          </div>
        </div>

        {/* ICAO Code */}
        <div className="text-sm">
          <span className="text-gray-600">ICAO:</span>
          <span className="ml-2 font-mono text-gray-800">{flight.icao24}</span>
        </div>

        {/* Position */}
        <div className="flex items-center space-x-3">
          <MapPin className="w-5 h-5 text-green-600" />
          <div className="text-sm">
            <div className="text-gray-600">Position</div>
            <div className="font-mono text-gray-800">
              {flight.gps.latitude.toFixed(4)},{" "}
              {flight.gps.longitude.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Altitude */}
        <div className="flex items-center space-x-3">
          <Navigation className="w-5 h-5 text-purple-600" />
          <div className="text-sm">
            <div className="text-gray-600">Altitude</div>
            <div className="font-medium text-gray-800">
              {formatAltitude(flight.gps.altitude)}
            </div>
          </div>
        </div>

        {/* Speed */}
        <div className="flex items-center space-x-3">
          <Gauge className="w-5 h-5 text-orange-600" />
          <div className="text-sm">
            <div className="text-gray-600">Speed</div>
            <div className="font-medium text-gray-800">
              {formatSpeed(flight.velocity)}
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="flex items-center space-x-3">
          <Navigation className="w-5 h-5 text-blue-600" />
          <div className="text-sm">
            <div className="text-gray-600">Heading</div>
            <div className="font-medium text-gray-800">
              {formatHeading(flight.heading)}
            </div>
          </div>
        </div>

        {/* Distance */}
        <div className="text-sm">
          <span className="text-gray-600">Distance from you:</span>
          <span className="ml-2 font-medium text-gray-800">
            {formatDistance(flight.distance)}
          </span>
        </div>

        {/* Elevation */}
        <div className="text-sm">
          <span className="text-gray-600">Elevation angle:</span>
          <span className="ml-2 font-medium text-gray-800">
            {flight.elevation.toFixed(1)}°
          </span>
        </div>

        {/* Status */}
        <div className="text-sm">
          <span className="text-gray-600">Status:</span>
          <span
            className={clsx(
              "ml-2 font-medium",
              flight.onGround ? "text-gray-600" : "text-green-600"
            )}
          >
            {flight.onGround ? "On Ground" : "In Flight"}
          </span>
        </div>

        {/* Last Update */}
        <div className="flex items-center space-x-3">
          <Clock className="w-4 h-4 text-gray-500" />
          <div className="text-sm text-gray-500">
            Updated {formatLastUpdate(flight.lastUpdate)}
          </div>
        </div>
      </div>
    </div>
  );
}
