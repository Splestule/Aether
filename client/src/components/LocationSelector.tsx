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
            <div className="p-2">
              <div className="text-sm font-medium mb-2 text-gray-900">Selected Location</div>
              <div className="text-xs text-gray-700 mb-2">
                Lat: {selectedPosition[0].toFixed(6)}
                <br />
                Lon: {selectedPosition[1].toFixed(6)}
                {elevation !== null && (
                  <>
                    <br />
                    Alt: {elevation.toFixed(0)}m
                  </>
                )}
              </div>
              {isLoading ? (
                <div className="text-xs text-gray-600">
                  Loading elevation...
                </div>
              ) : (
                <button
                  onClick={handleConfirmLocation}
                  className="w-full mt-2 px-3 py-1 bg-black text-white text-xs rounded hover:bg-gray-800 transition-colors"
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
        <span className="ml-2 text-gray-600">Loading map...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 text-sm text-gray-300">
        <MapPin className="w-4 h-4" />
        <span>Click on the map to select your location</span>
      </div>

      <div className="h-96 rounded-lg overflow-hidden border border-gray-300">
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

      <div className="flex items-center space-x-2 text-xs text-gray-400">
        <Navigation className="w-3 h-3" />
        <span>This will be your VR viewing position</span>
      </div>
    </div>
  );
}
