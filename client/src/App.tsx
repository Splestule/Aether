import { useState, useEffect } from "react";
import { VRScene } from "./components/VRScene";
import { LocationSelector } from "./components/LocationSelector";
import { FlightInfoPanel } from "./components/FlightInfoPanel";
import { VRControls } from "./components/VRControls";
import { useWebSocket } from "./hooks/useWebSocket";
import { useFlights } from "./hooks/useFlights";
import { UserLocation, ProcessedFlight } from "@shared/src/types";
import { config } from "./config";
import { ParticleField } from "./components/ParticleField";

function App() {
  console.log("App component rendering");

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<ProcessedFlight | null>(
    null
  );
  const [isVRActive, setIsVRActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRouteEnabled, setIsRouteEnabled] = useState(false);

  useEffect(() => {
    if (!userLocation && selectedFlight) {
      setSelectedFlight(null);
    }
  }, [userLocation, selectedFlight]);

  // Flight data management
  const {
    flights,
    flightsMap,
    clearFlights,
    updateFlights,
    extrapolatePositions,
  } = useFlights();

  // Refresh flights for current location
  const refreshFlights = async () => {
    if (!userLocation) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${config.apiUrl}/api/flights?lat=${userLocation.latitude}&lon=${userLocation.longitude}&radius=${config.vr.maxDistance}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          updateFlights(data.data);
          console.log(`Refreshed ${data.data.length} flights`);
        }
      }
    } catch (error) {
      console.error("Failed to refresh flights:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh flights every 30 seconds (API calls)
  useEffect(() => {
    if (!userLocation) return;

    const interval = setInterval(() => {
      refreshFlights();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [userLocation]);

  // Extrapolate flight positions every 5 seconds (no API calls)
  // Updates positions based on heading and speed without fetching from API
  useEffect(() => {
    if (!userLocation || flights.length === 0) return;

    const interval = setInterval(() => {
      extrapolatePositions(userLocation, 5); // 5 seconds time delta
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [userLocation, flights.length, extrapolatePositions]);

  const { isConnected, sendMessage } = useWebSocket(config.wsUrl, {
    onOpen: () => {
      console.log("WebSocket connected - ready to receive messages");
      // Try to subscribe right away if we have a location
      if (userLocation) {
        sendMessage({
          type: "subscribe_flights",
          data: {},
          timestamp: Date.now(),
        });
      }
    },
    onClose: () => {
      console.log("WebSocket disconnected");
    },
    onError: (error) => {
      console.error("WebSocket connection error:", error);
    },
    onMessage: (data) => {
      console.log("Received WebSocket message:", data);
      if (data.type === "flight_update") {
        updateFlights(data.data);
      }
    },
  });

  // Handle location selection
  const handleLocationSelect = async (location: UserLocation) => {
    setIsLoading(true);
    setUserLocation(location);
    clearFlights();

    try {
      // Get flights via REST API
      const response = await fetch(
        `${config.apiUrl}/api/flights?lat=${location.latitude}&lon=${location.longitude}&radius=${config.vr.maxDistance}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Update flights with the received data
          updateFlights(data.data);
          console.log(
            `Loaded ${data.data.length} flights for location ${location.latitude}, ${location.longitude}`
          );
          if (isConnected) {
            sendMessage({
              type: "subscribe_flights",
              data: {},
              timestamp: Date.now(),
            });

            sendMessage({
              type: "request_flights",
              data: {
                latitude: location.latitude,
                longitude: location.longitude,
                radius: config.vr.maxDistance,
              },
              timestamp: Date.now(),
            });
          }
        } else {
          console.warn("No flight data received");
        }
      } else {
        console.error(
          "Failed to fetch flights:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Failed to request flights:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle flight selection
  const handleFlightSelect = (flight: ProcessedFlight | null) => {
    setSelectedFlight(flight);
  };

  // Keep selected flight in sync with live flight updates (extrapolated or fetched)
  useEffect(() => {
    if (!selectedFlight) return;

    const updatedFlight = flightsMap.get(selectedFlight.id);
    if (updatedFlight && updatedFlight !== selectedFlight) {
      setSelectedFlight(updatedFlight);
    }
  }, [flights, flightsMap, selectedFlight?.id]);

  // Handle VR mode toggle
  const handleVRToggle = () => {
    setIsVRActive(!isVRActive);
  };

  return (
    <div className="h-screen w-screen relative">
      <ParticleField />
      {/* VR Scene */}
      {userLocation && (
        <VRScene
          userLocation={userLocation}
          flights={flights}
          selectedFlight={selectedFlight}
          onFlightSelect={handleFlightSelect}
          isVRActive={isVRActive}
          config={config.vr}
        />
      )}

      {/* Compass - shows direction user is looking */}
      {userLocation && (
        <div
          style={{
            position: "fixed",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10001,
            background: "rgba(26, 26, 26, 0.9)",
            border: "1px solid #ffffff",
            borderRadius: "8px",
            padding: "12px 24px",
            color: "#ffffff",
            fontSize: "24px",
            fontWeight: "bold",
            fontFamily: "monospace",
            letterSpacing: "2px",
            pointerEvents: "none",
            userSelect: "none",
          }}
          id="compass-display"
        >
          N
        </div>
      )}

      {/* UI Overlay */}
      <div className="vr-ui">
        {/* Location Selector */}
        {!userLocation && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="vr-panel p-5 max-w-3xl w-full mx-4 space-y-4">
              <div className="brand-header flex justify-center">
                <div className="flex items-center gap-2">
                  <img
                    src="/aether-logo.png"
                    alt="Aether logo"
                    className="brand-logo h-36 w-36 object-contain"
                  />
                  <h1 className="brand-title text-6xl">Aether</h1>
                </div>
              </div>
              <LocationSelector onLocationSelect={handleLocationSelect} />
            </div>
          </div>
        )}

        {/* VR Controls */}
        {userLocation && (
          <VRControls
            flightCount={flights.length}
            isLoading={isLoading}
            onBackToLocation={() => {
              setUserLocation(null);
              clearFlights();
              setSelectedFlight(null);
            }}
            onRefreshFlights={refreshFlights}
            isRouteEnabled={isRouteEnabled}
            onToggleRoute={() => setIsRouteEnabled((prev) => !prev)}
          />
        )}

        {/* Flight Info Panel */}
        {selectedFlight && (
          <FlightInfoPanel
            flight={selectedFlight}
            onClose={() => setSelectedFlight(null)}
            showRoute={isRouteEnabled}
          />
        )}

        {/* Loading Indicator - removed, using the one in VRControls (left side) */}
        {/* Debug Info - removed */}
      </div>
    </div>
  );
}

export default App;
