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
      className="flight-info-card"
      style={{
        position: "fixed", // Use fixed positioning for VR compatibility
        top: "16px",
        right: "16px",
        zIndex: 10000, // Ensure it appears above VR canvas
        minWidth: "360px",
        padding: "24px 28px",
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="compass-title text-xl">Flight Details</h3>
        <button
          onClick={onClose}
          className="group relative -mt-1 -mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-white/70 transition-colors duration-300 hover:text-blue-200 focus:outline-none"
          style={{ marginLeft: "auto" }}
        >
          <span className="sr-only">Close panel</span>
          <X className="w-5 h-5" />
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

        {/* Route */}
        <div className="flex items-start gap-3">
          <Navigation className="w-5 h-5 text-blue-300/80" />
          <div className="text-sm space-y-1">
            <div className="compass-subtle">Route</div>
            <div className="font-semibold tracking-[0.30em] uppercase">
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
          <ArrowUp className="w-5 h-5 text-white/60" />
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
