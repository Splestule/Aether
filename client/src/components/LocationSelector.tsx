import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { UserLocation } from "@shared/src/types.js";
import { MapPin, Navigation } from "lucide-react";
import { config } from "../config";

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LocationSelectorProps {
  onLocationSelect: (location: UserLocation) => void;
}

interface MapClickHandlerProps {
  onLocationSelect: (location: UserLocation) => void;
}

function MapClickHandler({ onLocationSelect }: MapClickHandlerProps) {
  const [selectedPosition, setSelectedPosition] = useState<
    [number, number] | null
  >(null);
  const [elevation, setElevation] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setSelectedPosition([lat, lng]);
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

  const handleConfirmLocation = () => {
    if (selectedPosition && elevation !== null) {
      onLocationSelect({
        latitude: selectedPosition[0],
        longitude: selectedPosition[1],
        altitude: elevation,
        name: `Location ${selectedPosition[0].toFixed(
          4
        )}, ${selectedPosition[1].toFixed(4)}`,
      });
    }
  };

  return (
    <>
      {selectedPosition && (
        <Marker position={selectedPosition}>
          <Popup>
            <div className="p-3 space-y-3 text-white bg-[rgba(15,15,15,0.9)] rounded-lg border border-white/30 backdrop-blur">
              <div className="compass-subtle">Selected Location</div>
              <div className="text-[0.7rem] tracking-[0.16em] text-white/80 space-y-1">
                Lat: {selectedPosition[0].toFixed(6)}
                <div>Lon: {selectedPosition[1].toFixed(6)}</div>
                {elevation !== null && (
                  <div>Alt: {elevation.toFixed(0)}m</div>
                )}
              </div>
              {isLoading ? (
                <div className="compass-subtle text-white/50">
                  Loading elevation…
                </div>
              ) : (
                <button
                  onClick={handleConfirmLocation}
                  className="vr-button w-full justify-center text-[0.55rem] tracking-[0.3em]"
                >
                  Select This Location
                </button>
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

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
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
        <span className="ml-4 compass-subtle tracking-[0.24em]">
          Loading map…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-center gap-3">
        <MapPin className="w-5 h-5 text-blue-300/80" />
        <span className="compass-title tracking-[0.26em] text-sm">
          Select Your Location
        </span>
      </div>

      <div className="h-96 rounded-2xl overflow-hidden border border-white/40 shadow-[0_24px_55px_rgba(15,23,42,0.55)]">
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
          <MapClickHandler onLocationSelect={onLocationSelect} />
        </MapContainer>
      </div>

      <div className="flex items-center gap-3">
        <Navigation className="w-4 h-4 text-white/50" />
        <span className="compass-subtle tracking-[0.24em]">
          This will be your VR viewing position
        </span>
      </div>
    </div>
  );
}
