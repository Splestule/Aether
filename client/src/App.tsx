import { useState, useEffect, useCallback, useRef } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { VRScene } from "./components/VRScene";
import { LocationSelector } from "./components/LocationSelector";
import { FlightInfoPanel } from "./components/FlightInfoPanel";
import { VRControls } from "./components/VRControls";
import { ErrorNotification, ErrorNotificationData } from "./components/ErrorNotification";
import { useWebSocket } from "./hooks/useWebSocket";
import { useFlights } from "./hooks/useFlights";
import { UserLocation, ProcessedFlight } from "@shared/src/types";
import { config } from "./config";
import { ParticleField } from "./components/ParticleField";
import { CesiumScene } from "./components/CesiumScene";

function App() {
  console.log("App component rendering");

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<ProcessedFlight | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRouteEnabled, setIsRouteEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<'vr' | 'cesium'>('vr');
  const [followingFlight, setFollowingFlight] = useState<ProcessedFlight | null>(null);
  const [errorNotification, setErrorNotification] = useState<ErrorNotificationData | null>(null);

  // Ref to store camera orientation when switching views
  const cameraOrientationRef = useRef<{ heading: number; pitch: number } | null>(null);

  // Load default coefficients from localStorage or use 1.0
  const loadDefaultCoefficients = () => {
    try {
      const savedHeight = localStorage.getItem('vr_height_coefficient');
      const savedDistance = localStorage.getItem('vr_distance_coefficient');
      return {
        height: savedHeight ? parseFloat(savedHeight) : 1.0,
        distance: savedDistance ? parseFloat(savedDistance) : 1.0,
      };
    } catch (error) {
      console.warn('Failed to load default coefficients:', error);
      return { height: 1.0, distance: 1.0 };
    }
  };

  const defaultCoeffs = loadDefaultCoefficients();
  const [heightCoefficient, setHeightCoefficient] = useState(defaultCoeffs.height);
  const [distanceCoefficient, setDistanceCoefficient] = useState(defaultCoeffs.distance);

  // Function to save current coefficients as defaults
  const saveCoefficientsAsDefaults = useCallback(() => {
    try {
      localStorage.setItem('vr_height_coefficient', heightCoefficient.toString());
      localStorage.setItem('vr_distance_coefficient', distanceCoefficient.toString());
      console.log('Coefficients saved as defaults:', { heightCoefficient, distanceCoefficient });
    } catch (error) {
      console.error('Failed to save default coefficients:', error);
    }
  }, [heightCoefficient, distanceCoefficient]);

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
    recalculatePositions,
  } = useFlights();

  // Helper function to detect and set error notification for HTTP errors
  const handleApiError = (response: Response) => {
    // Handle HTTP error responses
    const statusCode = response.status;
    let errorType: 'opensky' | 'network' | 'server' = 'server';
    let errorMessage = response.statusText || 'Unknown error';

    if (statusCode === 503 || statusCode === 429 || statusCode === 401 || statusCode === 403) {
      errorType = 'opensky';
      if (statusCode === 503) {
        errorMessage = 'OpenSky Network is currently unavailable';
      } else if (statusCode === 429) {
        errorMessage = 'Rate limit exceeded for OpenSky Network';
      } else if (statusCode === 401 || statusCode === 403) {
        errorMessage = 'OpenSky Network authentication failed';
      }
    } else if (statusCode >= 500) {
      errorType = 'server';
      errorMessage = 'Server error occurred';
    } else if (statusCode === 0 || !response.ok) {
      errorType = 'network';
      errorMessage = 'Network connection error';
    }

    setErrorNotification({
      type: errorType,
      message: errorMessage,
      statusCode,
      timestamp: Date.now(),
    });
  };

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

          // Check for OpenSky errors in successful response
          if (data.error) {
            setErrorNotification({
              type: data.error.type || 'opensky',
              message: data.error.message || 'OpenSky Network error',
              statusCode: data.error.statusCode,
              timestamp: Date.now(),
            });
          } else {
            // Clear error if everything is OK
            setErrorNotification(null);
          }
        }
      } else {
        handleApiError(response);
      }
    } catch (error) {
      console.error("Failed to refresh flights:", error);
      setErrorNotification({
        type: 'network',
        message: 'Failed to connect to server',
        timestamp: Date.now(),
      });
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
      extrapolatePositions(userLocation, 5, heightCoefficient, distanceCoefficient); // 5 seconds time delta
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [userLocation, flights.length, extrapolatePositions, heightCoefficient, distanceCoefficient]);

  // Recalculate positions when coefficients change
  useEffect(() => {
    if (!userLocation || flights.length === 0) return;
    console.log('Recalculating positions with coefficients:', { heightCoefficient, distanceCoefficient });
    recalculatePositions(userLocation, heightCoefficient, distanceCoefficient);
  }, [userLocation, heightCoefficient, distanceCoefficient, recalculatePositions, flights.length]);

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

          // Check for OpenSky errors in successful response
          if (data.error) {
            setErrorNotification({
              type: data.error.type || 'opensky',
              message: data.error.message || 'OpenSky Network error',
              statusCode: data.error.statusCode,
              timestamp: Date.now(),
            });
          } else {
            // Clear error if everything is OK
            setErrorNotification(null);
          }

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
        handleApiError(response);
      }
    } catch (error) {
      console.error("Failed to request flights:", error);
      setErrorNotification({
        type: 'network',
        message: 'Failed to connect to server',
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle flight selection
  const handleFlightSelect = (flight: ProcessedFlight | null) => {
    setSelectedFlight(flight);
    // If we deselect the flight we are following, stop following
    if (!flight && followingFlight) {
      setFollowingFlight(null);
    }
  };

  // Toggle Follow Mode
  const handleToggleFollow = () => {
    if (followingFlight) {
      // Stop following
      setFollowingFlight(null);
    } else if (selectedFlight) {
      // Start following
      setFollowingFlight(selectedFlight);
    }
  };

  // Keep selected flight in sync with live flight updates (extrapolated or fetched)
  useEffect(() => {
    if (!selectedFlight) return;

    const updatedFlight = flightsMap.get(selectedFlight.id);
    if (updatedFlight && updatedFlight !== selectedFlight) {
      setSelectedFlight(updatedFlight);
    }
  }, [flights, flightsMap, selectedFlight?.id]);

  // Hide react-three/xr AR button on mobile when flight is selected
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hideARButton = () => {
      const isMobile = window.innerWidth < 640;
      const shouldHide = isMobile && selectedFlight;

      // Find AR button - react-three/xr renders it with "Enter AR" or "AR unsupported" text
      const buttons = document.querySelectorAll('button');
      buttons.forEach((button) => {
        const text = (button.textContent || '').trim();
        // Match exact text or buttons that contain "AR" and are likely the AR button
        if (text === 'Enter AR' || text === 'AR unsupported' ||
          (text.includes('AR') && button.closest('canvas')?.nextElementSibling)) {
          if (shouldHide) {
            button.style.display = 'none';
            button.style.pointerEvents = 'none';
            button.style.visibility = 'hidden';
          } else {
            button.style.display = '';
            button.style.pointerEvents = '';
            button.style.visibility = '';
          }
        }
      });
    };

    // Run after a short delay to ensure ARCanvas has rendered
    const timeoutId = setTimeout(() => {
      hideARButton();
    }, 200);

    // Use MutationObserver to catch buttons added later by react-three/xr
    const observer = new MutationObserver(() => {
      setTimeout(() => {
        hideARButton();
      }, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const resizeHandler = () => {
      setTimeout(() => {
        hideARButton();
      }, 50);
    };
    window.addEventListener('resize', resizeHandler);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', resizeHandler);
      observer.disconnect();
      // Restore button visibility
      const buttons = document.querySelectorAll('button');
      buttons.forEach((button) => {
        const text = (button.textContent || '').trim();
        if (text === 'Enter AR' || text === 'AR unsupported') {
          button.style.display = '';
          button.style.pointerEvents = '';
          button.style.visibility = '';
        }
      });
    };
  }, [selectedFlight]);

  // Check if selected flight is out of range (not in current flights list)
  const isOutOfRange = selectedFlight ? !flights.some(f => f.id === selectedFlight.id) : false;

  return (
    <div className="h-screen w-screen relative">
      <ParticleField />
      {/* VR Scene */}
      {userLocation && viewMode === 'vr' && (
        <VRScene
          userLocation={userLocation}
          flights={flights}
          selectedFlight={selectedFlight}
          onFlightSelect={handleFlightSelect}
          config={config.vr}
          heightCoefficient={heightCoefficient}
          distanceCoefficient={distanceCoefficient}
          onHeightCoefficientChange={setHeightCoefficient}
          onDistanceCoefficientChange={setDistanceCoefficient}
          onSaveDefaults={saveCoefficientsAsDefaults}
          isOutOfRange={isOutOfRange}
          cameraRef={cameraOrientationRef}
        />
      )}

      {/* Cesium Scene */}
      {userLocation && viewMode === 'cesium' && (
        <CesiumScene
          userLocation={userLocation}
          flights={flights}
          selectedFlight={selectedFlight}
          onFlightSelect={handleFlightSelect}
          followingFlight={followingFlight}
          cameraRef={cameraOrientationRef}
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 pb-32 sm:pb-16 overflow-y-auto">
            <div className="vr-panel p-4 sm:p-[0.96rem] max-w-[36.9rem] w-full mx-4 space-y-4 sm:space-y-[0.77rem] max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-4rem)]">
              <div className="brand-header flex justify-center">
                <div className="flex items-center gap-2 sm:gap-[0.38rem]">
                  <img
                    src="/aether-logo.png"
                    alt="Aether logo"
                    className="brand-logo h-20 w-20 sm:h-[133px] sm:w-[133px] object-contain"
                  />
                  <h1 className="brand-title text-3xl sm:text-[46px]">Aether</h1>
                </div>
              </div>
              <LocationSelector onLocationSelect={handleLocationSelect} />
            </div>
          </div>
        )}

        {/* VR Controls - Show in both VR and Cesium (Real World) modes */}
        {userLocation && (viewMode === 'vr' || viewMode === 'cesium') && (
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

        {/* View Mode Toggle */}
        {userLocation && (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000] flex flex-col items-end gap-2 sm:gap-4">
            {/* Logo - moved from VRScene */}
            <div className="vr-panel hidden sm:flex items-center gap-3 sm:gap-5 px-3 py-2 sm:px-5 sm:py-4 pointer-events-none select-none">
              <img
                src="/aether-logo.png"
                alt="Aether logo"
                className="h-8 w-8 sm:h-[58px] sm:w-[58px] object-contain"
                style={{
                  filter: "drop-shadow(0 18px 32px rgba(56, 189, 248, 0.32))",
                }}
                draggable={false}
              />
              <span
                className="hidden sm:inline-block"
                style={{
                  fontFamily: '"Unbounded", "Stack Sans Notch", "Gabarito", sans-serif',
                  fontSize: "1.75rem",
                  letterSpacing: "0.12em",
                  textTransform: "none",
                  color: "#ffffff",
                  textShadow: "0 8px 24px rgba(15, 23, 42, 0.85)",
                  lineHeight: 1,
                }}
              >
                Aether
              </span>
            </div>

            {/* Mobile Logo - Bottom Left */}
            <div className="fixed bottom-6 left-6 z-[1000] flex sm:hidden pointer-events-none select-none opacity-70">
              <img
                src="/aether-logo.png"
                alt="Aether logo"
                className="h-12 w-12 object-contain"
                style={{
                  filter: "drop-shadow(0 4px 12px rgba(56, 189, 248, 0.3))",
                }}
                draggable={false}
              />
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => setViewMode('vr')}
                className={`vr-button w-full justify-center !px-3 !py-2.5 sm:!px-4 sm:!py-3 !text-[0.65rem] sm:!text-[0.7rem] !tracking-[0.15em] transition-all duration-300 ${viewMode === 'vr'
                  ? '!bg-[#c6a0e8] !text-black !border-[#c6a0e8] font-bold shadow-[0_0_20px_rgba(198,160,232,0.4)]'
                  : 'hover:!border-[#c6a0e8] hover:!text-[#c6a0e8]'
                  }`}
              >
                Passthrough View
              </button>
              <button
                onClick={() => setViewMode('cesium')}
                className={`vr-button w-full justify-center !px-3 !py-2.5 sm:!px-4 sm:!py-3 !text-[0.65rem] sm:!text-[0.7rem] !tracking-[0.15em] transition-all duration-300 ${viewMode === 'cesium'
                  ? '!bg-[#c6a0e8] !text-black !border-[#c6a0e8] font-bold shadow-[0_0_20px_rgba(198,160,232,0.4)]'
                  : 'hover:!border-[#c6a0e8] hover:!text-[#c6a0e8]'
                  }`}
              >
                Virtual Environment
              </button>
            </div>
          </div>
        )}
        {/* Back button removed - now handled by VRControls */}


        {/* Flight Info Panel */}
        {selectedFlight && (
          <FlightInfoPanel
            flight={selectedFlight}
            onClose={() => setSelectedFlight(null)}
            showRoute={isRouteEnabled}
            isFollowing={followingFlight?.id === selectedFlight.id}
            onToggleFollow={viewMode === 'cesium' ? handleToggleFollow : undefined}
            isOutOfRange={isOutOfRange}
          />
        )}

        {/* Error Notification */}
        <ErrorNotification
          error={errorNotification}
          onDismiss={() => setErrorNotification(null)}
          onRetry={userLocation ? refreshFlights : undefined}
        />

        {/* Loading Indicator - removed, using the one in VRControls (left side) */}
        {/* Debug Info - removed */}
      </div>

      {/* Made by + OpenSky citation footer - only show on homepage */}
      {
        !userLocation && (
          <div className="fixed bottom-0 sm:bottom-2 left-1/2 -translate-x-1/2 z-[10002] text-white/80 px-4 text-center w-[100%] sm:w-auto sm:max-w-screen-lg pointer-events-none">
            <p className="text-[10px] sm:text-sm">
              Made by Eduard Šimon of Gymnázium Žďár nad Sázavou ©
            </p>
            <div className="mt-2 text-[6.5px] sm:text-[9px] text-white/70">
              <p className="text-[7.5px] sm:text-[11px] text-white/80">Data from OpenSky Network</p>
              <p>Matthias Schäfer, Martin Strohmeier, Vincent Lenders, Ivan Martinovic and Matthias Wilhelm.</p>
              <p>"Bringing Up OpenSky: A Large-scale ADS-B Sensor Network for Research".</p>
              <p className="whitespace-normal sm:whitespace-nowrap">In Proceedings of the 13th IEEE/ACM International Symposium on Information Processing in Sensor Networks (IPSN), pages 83-94, April 2014.</p>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default App;
