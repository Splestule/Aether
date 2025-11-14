import { useState, useEffect, Dispatch, SetStateAction } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { UserLocation } from "@shared/src/types.js";
import { config } from "../config";

// Create custom purple marker icon (matching original Leaflet design with purple color)
const createPurpleMarkerIcon = () => {
  // Use unique ID for gradients to avoid conflicts if multiple markers
  const uniqueId = `marker-${Math.random().toString(36).substr(2, 9)}`;
  
  return L.divIcon({
    className: 'custom-purple-marker',
    html: `
      <svg width="25" height="41" viewBox="0 0 25 41" version="1.1" xmlns="http://www.w3.org/2000/svg" style="display: block;">
        <defs>
          <linearGradient id="${uniqueId}-purpleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#9d6fd0;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#7a4fb0;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#5d2f8a;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="${uniqueId}-purpleGradLight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#b891e5;stop-opacity:0.5" />
            <stop offset="100%" style="stop-color:#9d6fd0;stop-opacity:0.2" />
          </linearGradient>
        </defs>
        <!-- Shadow ellipse at bottom -->
        <ellipse cx="12.5" cy="38.5" rx="4.5" ry="2.5" fill="#000" opacity="0.35"/>
        <!-- Main marker shape with gradient (darker purple) -->
        <path fill="url(#${uniqueId}-purpleGrad)" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" 
              d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.75 12.5 28.5 12.5 28.5s12.5-19.75 12.5-28.5C25 5.596 19.404 0 12.5 0z"/>
        <!-- Highlight/shine on top left portion -->
        <path fill="url(#${uniqueId}-purpleGradLight)" 
              d="M12.5 0C5.596 0 0 5.596 0 12.5c0 2.5 1.5 5 4 6.5 0.8-1.8 2-3.5 3.5-5 1-1 2.5-2 3.5-3.5 0.8-1.2 1-3 1-4.5C13 5.596 19.404 0 12.5 0z"/>
        <!-- White center circle -->
        <circle cx="12.5" cy="12.5" r="4.5" fill="#ffffff"/>
        <!-- Inner subtle highlight on circle -->
        <circle cx="11.5" cy="11.5" r="2.5" fill="#ffffff" opacity="0.4"/>
      </svg>
    `,
    iconSize: [25, 41],
    iconAnchor: [12.5, 41], // Anchor: x=12.5 (center horizontally), y=41 (bottom) - this positions the bottom tip at the click point
    popupAnchor: [0, -63], // Popup positioned above the pin
  });
};

interface LocationSelectorProps {
  onLocationSelect: (location: UserLocation) => void;
}

interface MapClickHandlerProps {
  selectedPosition: [number, number] | null;
  elevation: number | null;
  isLoading: boolean;
  setSelectedPosition: Dispatch<SetStateAction<[number, number] | null>>;
  setElevation: Dispatch<SetStateAction<number | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

function MapClickHandler({
  selectedPosition,
  elevation,
  isLoading,
  setSelectedPosition,
  setElevation,
  setIsLoading,
}: MapClickHandlerProps) {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setSelectedPosition([lat, lng]);
      setElevation(null);
      setIsLoading(true);

      try {
        // Get elevation data
        const elevationResponse = await fetch(
          `${config.apiUrl}/api/elevation?lat=${lat}&lon=${lng}`
        );
        const elevationData = await elevationResponse.json();
        setElevation(elevationData.elevation);
      } catch (error) {
        console.error("Failed to get elevation:", error);
        setElevation(0); // Default to sea level
      } finally {
        setIsLoading(false);
      }
    },
  });

  return (
    <>
      {selectedPosition && (
        <Marker position={selectedPosition} icon={createPurpleMarkerIcon()}>
          <Popup
            autoPanPadding={[0, 0]}
            className="!m-0 !p-0 !border-none !bg-transparent"
          >
            <div className="p-3 sm:p-[0.77rem] space-y-2 sm:space-y-[0.58rem] text-white bg-[rgba(15,15,15,0.95)] rounded-xl border border-white/20 backdrop-blur-lg shadow-[0_18px_45px_rgba(15,23,42,0.55)] min-w-[140px] sm:min-w-[169px]">
              <div className="compass-subtle text-xs sm:text-[0.46rem]">Selected Location</div>
              <div className="text-xs sm:text-[0.54rem] tracking-[0.16em] text-white/80 space-y-1 sm:space-y-[0.19rem]">
                Lat: {selectedPosition[0].toFixed(6)}
                <div>Lon: {selectedPosition[1].toFixed(6)}</div>
                {elevation !== null && <div>Alt: {elevation.toFixed(0)}m</div>}
              </div>
              {isLoading && (
                <div className="compass-subtle text-white/50 text-xs sm:text-[0.46rem]">
                  Loading elevation…
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

export function LocationSelector({ onLocationSelect }: LocationSelectorProps) {
  const [currentLocation, setCurrentLocation] = useState<
    [number, number] | null
  >(null);
  const [selectedPosition, setSelectedPosition] = useState<
    [number, number] | null
  >(null);
  const [selectedElevation, setSelectedElevation] = useState<number | null>(
    null
  );
  const [isSelectionLoading, setIsSelectionLoading] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;

    // Set a timeout to prevent infinite loading in VR browsers
    timeoutId = setTimeout(() => {
      // Default to Prague, Czech Republic if geolocation takes too long
      if (isMounted) {
        setCurrentLocation([50.0755, 14.4378]);
      }
    }, 3000); // 3 second timeout for VR browsers

    // Try to get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (isMounted) {
            clearTimeout(timeoutId);
            setCurrentLocation([
              position.coords.latitude,
              position.coords.longitude,
            ]);
          }
        },
        (error) => {
          if (isMounted) {
            clearTimeout(timeoutId);
            console.warn("Could not get current location:", error);
            // Default to Prague, Czech Republic
            setCurrentLocation([50.0755, 14.4378]);
          }
        },
        {
          timeout: 2000, // 2 second timeout for geolocation
          enableHighAccuracy: false, // Disable high accuracy for faster response in VR
        }
      );
    } else {
      clearTimeout(timeoutId);
      // Default to Prague, Czech Republic
      if (isMounted) {
        setCurrentLocation([50.0755, 14.4378]);
      }
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  if (!currentLocation) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading-spinner"></div>
        <span className="ml-4 compass-subtle tracking-[0.24em] text-xs sm:text-[0.46rem]">
          Loading map…
        </span>
      </div>
    );
  }

  const handleConfirmLocation = () => {
    if (!selectedPosition || selectedElevation === null || isSelectionLoading) {
      return;
    }

    onLocationSelect({
      latitude: selectedPosition[0],
      longitude: selectedPosition[1],
      altitude: selectedElevation ?? 0,
      name: `Location ${selectedPosition[0].toFixed(
        4
      )}, ${selectedPosition[1].toFixed(4)}`,
    });
  };

  return (
    <div className="space-y-[0.77rem] text-white">
      <div className="h-[20rem] sm:h-[24.6rem] rounded-2xl overflow-hidden border border-white/40 shadow-[0_30px_65px_rgba(15,23,42,0.55)]">
        <MapContainer
          center={currentLocation}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            maxNativeZoom={19}
          />
          <MapClickHandler
            selectedPosition={selectedPosition}
            elevation={selectedElevation}
            isLoading={isSelectionLoading}
            setSelectedPosition={setSelectedPosition}
            setElevation={setSelectedElevation}
            setIsLoading={setIsSelectionLoading}
          />
        </MapContainer>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleConfirmLocation}
          disabled={
            !selectedPosition ||
            isSelectionLoading ||
            selectedElevation === null
          }
          className="vr-button justify-center px-4 py-2 sm:px-[1.54rem] sm:py-[0.77rem] text-xs sm:text-[0.58rem]"
        >
          Select This Location
        </button>
      </div>
    </div>
  );
}
