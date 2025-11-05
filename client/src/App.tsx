import { useState, useEffect } from "react";
import { VRScene } from "./components/VRScene";
import { LocationSelector } from "./components/LocationSelector";
import { FlightInfoPanel } from "./components/FlightInfoPanel";
import { VRControls } from "./components/VRControls";
import { useWebSocket } from "./hooks/useWebSocket";
import { useFlights } from "./hooks/useFlights";
import { UserLocation, ProcessedFlight } from "@shared/src/types";
import { config } from "./config";

function App() {
  console.log("App component rendering");

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<ProcessedFlight | null>(
    null
  );
  const [isVRActive, setIsVRActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Flight data management
  const { flights, clearFlights, updateFlights } = useFlights();

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

  // Auto-refresh flights every 30 seconds
  useEffect(() => {
    if (!userLocation) return;

    const interval = setInterval(() => {
      refreshFlights();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [userLocation]);

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

  // Handle VR mode toggle
  const handleVRToggle = () => {
    setIsVRActive(!isVRActive);
  };

  // Load demo flights for testing
  const loadDemoFlights = async () => {
    setIsLoading(true);
    try {
      // Set demo location (Prague)
      const demoLocation: UserLocation = {
        latitude: 50.0755,
        longitude: 14.4378,
        altitude: 200,
        name: "Prague, Czech Republic",
      };
      setUserLocation(demoLocation);

      // First try WebSocket if connected
      if (isConnected) {
        console.log("Requesting flights via WebSocket");
        sendMessage({
          type: "subscribe_flights",
          data: {},
          timestamp: Date.now(),
        });

        sendMessage({
          type: "request_flights",
          data: {
            latitude: demoLocation.latitude,
            longitude: demoLocation.longitude,
            radius: config.vr.maxDistance,
          },
          timestamp: Date.now(),
        });
      }

      // Fallback to REST API
      const response = await fetch(
        `${config.apiUrl}/api/flights?lat=50.0755&lon=14.4378&radius=50`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          updateFlights(data.data);
          console.log(`Loaded ${data.data.length} demo flights`);
        }
      }
    } catch (error) {
      console.error("Failed to load demo flights:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen relative">
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="vr-panel p-6 max-w-2xl w-full mx-4">
              <h1 className="text-3xl font-bold text-center mb-6 text-white">
                VR Flight Tracker
              </h1>
              <p className="text-center text-gray-400 mb-6">
                Select a location on the map to start tracking flights in VR
                space
              </p>
              <LocationSelector onLocationSelect={handleLocationSelect} />

              {/* Demo Button */}
              <div className="mt-6 text-center">
                <button
                  onClick={loadDemoFlights}
                  className="bg-white text-black px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Load Demo Flights (Prague)
                </button>
                <p className="text-sm text-gray-400 mt-2">
                  Click this to see demo flights around Prague for testing
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VR Controls */}
        {userLocation && (
          <VRControls
            isVRActive={isVRActive}
            onVRToggle={handleVRToggle}
            isConnected={isConnected}
            flightCount={flights.length}
            isLoading={isLoading}
            onBackToLocation={() => {
              setUserLocation(null);
              clearFlights();
            }}
            onRefreshFlights={refreshFlights}
          />
        )}

        {/* Flight Info Panel */}
        {selectedFlight && (
          <FlightInfoPanel
            flight={selectedFlight}
            onClose={() => setSelectedFlight(null)}
          />
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute top-4 right-4 vr-panel p-4">
            <div className="flex items-center space-x-2">
              <div className="loading-spinner"></div>
              <span className="text-sm text-gray-600">Loading flights...</span>
            </div>
          </div>
        )}

        {/* Debug Info */}
        <div className="absolute bottom-4 right-4 vr-panel p-3 text-xs max-w-sm">
          <div>
            WebSocket: {isConnected ? "✅ Connected" : "❌ Disconnected"}
          </div>
          <div>Flights: {flights.length}</div>
          <div>
            Location: {userLocation ? "✅ Selected" : "❌ Not selected"}
          </div>
          <div>Loading: {isLoading ? "⏳ Yes" : "✅ No"}</div>
          {flights.length > 0 && (
            <div className="mt-2">
              <div>First flight: {flights[0]?.callsign}</div>
              <div>
                Position: {flights[0]?.position.x?.toFixed(1)},{" "}
                {flights[0]?.position.y?.toFixed(1)},{" "}
                {flights[0]?.position.z?.toFixed(1)}
              </div>
              <div>Distance: {flights[0]?.distance?.toFixed(1)}km</div>
            </div>
          )}

          {/* Flight List for Debugging */}
          {flights.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto">
              <div className="font-semibold">Flights:</div>
              {flights.slice(0, 5).map((flight) => (
                <div key={flight.id} className="text-xs">
                  {flight.callsign} - {flight.distance?.toFixed(1)}km
                </div>
              ))}
              {flights.length > 5 && (
                <div className="text-xs">... and {flights.length - 5} more</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
