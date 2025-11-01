import { Suspense } from "react";
import { Interactive, useXR, DefaultXRControllers, ARCanvas, XRButton } from "@react-three/xr";
import { OrbitControls, Sky, Text, Billboard } from "@react-three/drei";
import { UserLocation, ProcessedFlight, VRConfig } from "@shared/src/types.js";
import { ARWaypoint } from "./ARWaypoint";
import { FlightTrajectory } from "./FlightTrajectory";
import {
  formatSpeed,
  formatAltitude,
  formatDistance,
} from "@shared/src/utils.js";
import React from "react";

interface VRSceneProps {
  userLocation: UserLocation;
  flights: ProcessedFlight[];
  selectedFlight: ProcessedFlight | null;
  onFlightSelect: (flight: ProcessedFlight | null) => void;
  isVRActive: boolean;
  config: VRConfig;
}


// VR Info Panel Component - displays flight info in VR space
function VRInfoPanel({ flight }: { flight: ProcessedFlight }) {
  return (
    <Billboard position={[0, 1.8, -1.2]}>
      <group>
        {/* Background panel */}
        <mesh>
          <planeGeometry args={[3.5, 2.5]} />
          <meshBasicMaterial color="#000000" opacity={0.9} transparent />
        </mesh>
      
      {/* Flight info text */}
      <Text
        position={[0, 1, 0.01]}
        fontSize={0.15}
        color="#ffffff"
        anchorX="center"
        anchorY="top"
        maxWidth={3}
      >
        {flight.callsign}
      </Text>
      
      <Text
        position={[0, 0.7, 0.01]}
        fontSize={0.1}
        color="#cccccc"
        anchorX="center"
        anchorY="top"
        maxWidth={3}
      >
        {flight.airline || "Unknown Airline"}
      </Text>

      <Text
        position={[0, 0.4, 0.01]}
        fontSize={0.08}
        color="#ffffff"
        anchorX="center"
        anchorY="top"
        maxWidth={3}
      >
        Altitude: {formatAltitude(flight.gps.altitude)}
      </Text>

      <Text
        position={[0, 0.25, 0.01]}
        fontSize={0.08}
        color="#ffffff"
        anchorX="center"
        anchorY="top"
        maxWidth={3}
      >
        Speed: {formatSpeed(flight.velocity)}
      </Text>

      <Text
        position={[0, 0.1, 0.01]}
        fontSize={0.08}
        color="#ffffff"
        anchorX="center"
        anchorY="top"
        maxWidth={3}
      >
        Distance: {formatDistance(flight.distance)}
      </Text>

      <Text
        position={[0, -0.05, 0.01]}
        fontSize={0.08}
        color="#ffffff"
        anchorX="center"
        anchorY="top"
        maxWidth={3}
      >
        Heading: {flight.heading.toFixed(0)}°
      </Text>

      {/* Close hint */}
      <Text
        position={[0, -1, 0.01]}
        fontSize={0.06}
        color="#aaaaaa"
        anchorX="center"
        anchorY="top"
      >
        (Click same plane again to close)
      </Text>
      </group>
    </Billboard>
  );
}

// Scene Content Component
function SceneContent({
  flights,
  selectedFlight,
  onFlightSelect,
  config,
}: Omit<VRSceneProps, "isVRActive">) {
  const { isPresenting } = useXR();

  const filteredFlights = flights.filter(
    (flight) => flight.distance <= config.maxDistance
  );

  return (
    <>
      {/* Enhanced lighting for AR - brighter and more visible */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[100, 100, 50]} intensity={1.5} castShadow />
      <hemisphereLight color="#ffffff" groundColor="#888888" intensity={0.8} />
      <directionalLight position={[-50, 50, -50]} intensity={0.8} />

      {/* VR Controllers - visible in AR/VR mode */}
      {isPresenting && <DefaultXRControllers />}

      {/* Environment - Sky - only show when NOT in AR/VR (passthrough shows real world) */}
      {!isPresenting && (
        <Sky
          distance={450000}
          sunPosition={[0, 1, 0]}
          inclination={0.49}
          azimuth={0.25}
        />
      )}

      {/* Flight objects - make them interactive in VR */}
      {filteredFlights.map((flight) => (
        <React.Fragment key={flight.id}>
          <Interactive 
            onSelect={() => {
              // Toggle selection - click same flight to deselect
              if (selectedFlight?.id === flight.id) {
                onFlightSelect(null);
              } else {
                onFlightSelect(flight);
              }
            }}
          >
            <ARWaypoint
              flight={flight}
              isSelected={selectedFlight?.id === flight.id}
              onClick={() => {
                if (selectedFlight?.id === flight.id) {
                  onFlightSelect(null);
                } else {
                  onFlightSelect(flight);
                }
              }}
            />
          </Interactive>
          {config.enableTrajectories && <FlightTrajectory flight={flight} />}
        </React.Fragment>
      ))}

      {/* Show selected flight info in VR space */}
      {isPresenting && selectedFlight && (
        <VRInfoPanel flight={selectedFlight} />
      )}

      {/* Controls - only enabled when not in VR */}
      {!isPresenting && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableRotate={true}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          target={[0, 0, 0]}
          enableDamping={true}
          dampingFactor={0.05}
          rotateSpeed={0.5}
        />
      )}
    </>
  );
}

export function VRScene({
  userLocation,
  flights,
  selectedFlight,
  onFlightSelect,
  config,
}: VRSceneProps) {
  return (
    <>
      {/* XRButton outside ARCanvas but in the same component */}
      <XRButton
        mode="AR"
        sessionInit={{
          requiredFeatures: ["local-floor"],
          optionalFeatures: ["bounded-floor", "hand-tracking"],
        }}
        style={{
          position: "fixed",
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "linear-gradient(to right, rgba(147, 51, 234, 1), rgba(219, 39, 119, 1))",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "12px 24px",
          fontWeight: "bold",
          cursor: "pointer",
          zIndex: 1000,
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
        }}
      >
        🚀 Enter Mixed Reality
      </XRButton>

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "linear-gradient(to bottom, #1a1a2e 0%, #16213e 100%)",
        }}
      >
        <ARCanvas
          camera={{
            position: [0, 1.6, 0],
            fov: 75,
            near: 0.1,
            far: 10000,
          }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
          sessionInit={{
            requiredFeatures: ["local-floor"],
            optionalFeatures: ["bounded-floor", "hand-tracking"],
          }}
        >
          <Suspense fallback={null}>
            <SceneContent
              userLocation={userLocation}
              flights={flights}
              selectedFlight={selectedFlight}
              onFlightSelect={onFlightSelect}
              config={config}
            />
          </Suspense>
        </ARCanvas>
      </div>
    </>
  );
}
