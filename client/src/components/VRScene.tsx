import { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import { UserLocation, ProcessedFlight, VRConfig } from "@shared/src/types.js";
//import { Aircraft } from "./Aircraft";
import { ARWaypoint } from "./ARWaypoint";
import { FlightTrajectory } from "./FlightTrajectory";
import React from "react";

interface VRSceneProps {
  userLocation: UserLocation;
  flights: ProcessedFlight[];
  selectedFlight: ProcessedFlight | null;
  onFlightSelect: (flight: ProcessedFlight | null) => void;
  isVRActive: boolean;
  config: VRConfig;
}

export function VRScene({
  flights,
  selectedFlight,
  onFlightSelect,
  isVRActive,
  config,
}: VRSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVRSupported, setIsVRSupported] = useState(false);

  // Debug logging
  console.log("VRScene: Received flights:", flights.length);
  if (flights.length > 0) {
    console.log("VRScene: First flight:", flights[0]);
  }

  useEffect(() => {
    // Check VR support
    if ("xr" in navigator) {
      (navigator as any).xr
        .isSessionSupported("immersive-vr")
        .then((supported: boolean) => {
          setIsVRSupported(supported);
        });
    }
  }, []);

  return (
    <div className="vr-canvas">
      <Canvas
        ref={canvasRef}
        camera={{ position: [0, 0, 0], fov: 75 }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        {/* AR Environment - Minimal for passthrough */}
        <Sky
          distance={450000}
          sunPosition={[0, 1, 0]}
          inclination={0.49}
          azimuth={0.25}
        />

        {/* User position indicator - smaller and more subtle for AR */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
        </mesh>

        {/* Flight objects - AR waypoints for better visibility */}
        {flights
          .filter((flight) => flight.distance <= config.maxDistance)
          .map((flight) => (
            <React.Fragment key={flight.id}>
              <ARWaypoint
                flight={flight}
                isSelected={selectedFlight?.id === flight.id}
                onClick={() => onFlightSelect(flight)}
              />
              {config.enableTrajectories && (
                <FlightTrajectory flight={flight} />
              )}
            </React.Fragment>
          ))}

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={100}
          target={[0, 0, 0]}
        />
      </Canvas>

      {/* VR Entry Button - Disabled for now */}
      {false && isVRSupported && !isVRActive && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <button className="vr-button">Enter VR (Coming Soon)</button>
        </div>
      )}
    </div>
  );
}
