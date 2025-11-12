import {
  Plane,
  MapPin,
  Gauge,
  Navigation,
  Clock,
  ArrowUp,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProcessedFlight } from "@shared/src/types.js";
import type { FlightRouteInfo } from "@shared/src/types.js";
import {
  formatSpeed,
  formatAltitude,
  formatDistance,
} from "@shared/src/utils.js";
import { clsx } from "clsx";
import { config } from "../config";

interface FlightInfoPanelProps {
  flight: ProcessedFlight;
  onClose: () => void;
  showRoute: boolean;
}

export function FlightInfoPanel({
  flight,
  onClose,
  showRoute,
}: FlightInfoPanelProps) {
  const [routeInfo, setRouteInfo] = useState<FlightRouteInfo | null>(null);
  const [routeStatus, setRouteStatus] = useState<
    "idle" | "loading" | "success" | "empty" | "error" | "disabled"
  >("idle");
  const routeCacheRef = useRef<Map<string, FlightRouteInfo>>(new Map());

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

  const getEndpointCode = (endpoint: FlightRouteInfo["origin"]): string => {
    if (!endpoint) return "UNK";
    const code = endpoint.iata?.trim() || endpoint.icao?.trim();
    return code?.toUpperCase() || "UNK";
  };

  useEffect(() => {
    const callsign = flight.callsign?.replace(/\s+/g, "").toUpperCase();

    if (!showRoute) {
      setRouteInfo(null);
      setRouteStatus("disabled");
      return;
    }

    if (!callsign) {
      setRouteInfo(null);
      setRouteStatus("empty");
      return;
    }

    const cachedRoute = routeCacheRef.current.get(callsign);
    if (cachedRoute) {
      setRouteInfo(cachedRoute);
      setRouteStatus("success");
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const fetchRoute = async () => {
      try {
        setRouteStatus("loading");
        setRouteInfo(null);

        const params = new URLSearchParams({ callsign });
        const url = `${config.apiUrl}/api/flights/route?${params.toString()}`;
        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            if (isMounted) {
              setRouteStatus("empty");
              setRouteInfo(null);
            }
            return;
          }

          const errorBody = await response
            .json()
            .catch(() => ({ error: "Unable to retrieve flight route" }));

          throw new Error(
            errorBody?.error ||
              errorBody?.message ||
              "Unable to retrieve flight route"
          );
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          const fallback = await response.text();
          throw new Error(
            `Unexpected response format (${contentType || "unknown"}): ${fallback.slice(0, 120)}`
          );
        }

        const json = await response.json();
        const data = json?.data as FlightRouteInfo | undefined;

        if (!data) {
          if (isMounted) {
            setRouteStatus("empty");
            setRouteInfo(null);
          }
          return;
        }

        routeCacheRef.current.set(callsign, data);

        if (isMounted) {
          setRouteInfo(data);
          setRouteStatus("success");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch route info", error);
        if (isMounted) {
          setRouteStatus("error");
        }
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [flight.callsign, showRoute]);

  return (
    <div
      className="flight-info-card fixed bottom-0 right-0 left-0 sm:bottom-auto sm:top-4 sm:left-auto sm:right-4 min-w-[280px] max-w-none sm:max-w-[360px] sm:min-w-[360px] sm:max-w-none p-3 sm:p-[24px_28px] max-h-[50vh] sm:max-h-none overflow-y-auto sm:overflow-visible"
      style={{
        zIndex: 10000, // Ensure it appears above VR canvas
      }}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-6">
        <h3 className="compass-title text-sm sm:text-xl">Flight Details</h3>
        <button
          onClick={onClose}
          className="group relative -mt-1 -mr-2 inline-flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-transparent text-white/70 transition-colors duration-300 hover:text-[#c6a0e8] focus:outline-none"
          style={{ marginLeft: "auto" }}
        >
          <span className="sr-only">Close panel</span>
          <X className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
        </button>
      </div>

      <div className="space-y-3 sm:space-y-5">
        {/* Flight Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Plane className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#c6a0e8]/80 flex-shrink-0" />
          <div>
            <div className="text-xs sm:text-base font-semibold uppercase tracking-[0.24em] sm:tracking-[0.28em]">
              {flight.callsign}
            </div>
            <div className="compass-subtle tracking-[0.20em] sm:tracking-[0.22em] text-[10px] sm:text-[0.6rem]">
              {flight.airline}
            </div>
          </div>
        </div>

        {/* Route */}
        <div className="flex items-start gap-2 sm:gap-3">
          <Navigation className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#c6a0e8]/80 flex-shrink-0" />
          <div className="text-[10px] sm:text-sm space-y-0.5 sm:space-y-1">
            <div className="compass-subtle text-[10px] sm:text-[0.6rem]">Route</div>
            <div className="font-semibold tracking-[0.24em] sm:tracking-[0.30em] uppercase text-[10px] sm:text-sm">
            {!showRoute && "Route unavailable"}
            {showRoute && routeStatus === "loading" && "Loading route..."}
            {showRoute && routeStatus === "success" &&
                routeInfo &&
                `${getEndpointCode(routeInfo.origin)} → ${getEndpointCode(
                  routeInfo.destination
              )}`}
            {showRoute &&
              routeStatus !== "loading" &&
              routeStatus !== "success" &&
              "Route unavailable"}
            </div>
          </div>
        </div>

        {/* ICAO Code */}
        <div className="text-[10px] sm:text-sm">
          <span className="compass-subtle text-[10px] sm:text-[0.6rem]">ICAO</span>
          <span className="ml-2 sm:ml-3 font-semibold tracking-[0.20em] sm:tracking-[0.24em] uppercase text-[10px] sm:text-sm">
            {flight.icao24}
          </span>
        </div>

        {/* Position */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <MapPin className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white/60 flex-shrink-0" />
          <div className="text-[10px] sm:text-sm space-y-0.5 sm:space-y-1">
            <div className="compass-subtle text-[10px] sm:text-[0.6rem]">Position</div>
            <div className="font-semibold tracking-[0.16em] sm:tracking-[0.18em] text-[10px] sm:text-sm">
              {flight.gps.latitude.toFixed(4)},{" "}
              {flight.gps.longitude.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Altitude */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <ArrowUp className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white/60 flex-shrink-0" />
          <div className="text-[10px] sm:text-sm">
            <div className="compass-subtle text-[10px] sm:text-[0.6rem]">Altitude</div>
            <div className="font-semibold tracking-[0.16em] sm:tracking-[0.18em] uppercase text-[10px] sm:text-sm">
              {formatAltitude(flight.gps.altitude)}
            </div>
          </div>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Gauge className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white/60 flex-shrink-0" />
          <div className="text-[10px] sm:text-sm">
            <div className="compass-subtle text-[10px] sm:text-[0.6rem]">Speed</div>
            <div className="font-semibold tracking-[0.16em] sm:tracking-[0.18em] uppercase text-[10px] sm:text-sm">
              {formatSpeed(flight.velocity)}
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Navigation className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white/60 flex-shrink-0" />
          <div className="text-[10px] sm:text-sm">
            <div className="compass-subtle text-[10px] sm:text-[0.6rem]">Heading</div>
            <div className="font-semibold tracking-[0.16em] sm:tracking-[0.18em] uppercase text-[10px] sm:text-sm">
              {formatHeading(flight.heading)}
            </div>
          </div>
        </div>

        {/* Distance */}
        <div className="text-[10px] sm:text-sm">
          <span className="compass-subtle text-[10px] sm:text-[0.6rem]">Distance from you</span>
          <span className="ml-1.5 sm:ml-3 font-semibold tracking-[0.16em] sm:tracking-[0.18em] uppercase text-[10px] sm:text-sm">
            {formatDistance(flight.distance)}
          </span>
        </div>

        {/* Elevation */}
        <div className="text-[10px] sm:text-sm">
          <span className="compass-subtle text-[10px] sm:text-[0.6rem]">Elevation Angle</span>
          <span className="ml-1.5 sm:ml-3 font-semibold tracking-[0.16em] sm:tracking-[0.18em] uppercase text-[10px] sm:text-sm">
            {flight.elevation.toFixed(1)}°
          </span>
        </div>

        {/* Status */}
        <div className="text-[10px] sm:text-sm">
          <span className="compass-subtle text-[10px] sm:text-[0.6rem]">Status</span>
          <span
            className={clsx(
              "ml-1.5 sm:ml-3 font-semibold tracking-[0.16em] sm:tracking-[0.18em] uppercase text-[10px] sm:text-sm",
              flight.onGround ? "text-white/50" : "text-[#c6a0e8]"
            )}
          >
            {flight.onGround ? "On Ground" : "In Flight"}
          </span>
        </div>

        {/* Last Update */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Clock className="w-2.5 h-2.5 sm:w-4 sm:h-4 text-white/40 flex-shrink-0" />
          <div className="compass-subtle tracking-[0.20em] sm:tracking-[0.22em] text-[10px] sm:text-[0.6rem]">
            Updated {formatLastUpdate(flight.lastUpdate)}
          </div>
        </div>
      </div>
    </div>
  );
}
