import { Suspense, useRef } from "react";
import { Interactive, useXR, DefaultXRControllers, ARCanvas, XRButton, useController } from "@react-three/xr";
import { OrbitControls, Sky, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Vector3, Euler, Quaternion } from "three";
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


// VR Flight Info Panel - 3D panel attached to left controller
function VRFlightInfoPanel({ 
  flight, 
  onClose 
}: { 
  flight: ProcessedFlight; 
  onClose: () => void;
}) {
  const leftController = useController("left");
  const panelRef = useRef<any>(null);

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

  // Attach panel to left controller
  useFrame(() => {
    if (panelRef.current && leftController) {
      // Get controller position and rotation
      const controller = leftController.controller;
      panelRef.current.position.copy(controller.position);
      panelRef.current.quaternion.copy(controller.quaternion);
      
      // Apply additional tilt backward (rotate around X axis) for better reading angle
      const tiltBackRotation = new Euler(-Math.PI / 6, 0, 0); // -30 degrees around X axis
      const tiltQuaternion = new Quaternion().setFromEuler(tiltBackRotation);
      panelRef.current.quaternion.multiply(tiltQuaternion);
      
      // Offset panel relative to controller (in front and slightly up, in controller's local space)
      // Convert local offset to world space
      const localOffset = new Vector3(0.08, 0.1, 0.12);
      localOffset.applyQuaternion(controller.quaternion);
      panelRef.current.position.add(localOffset);
    }
  });

  // Scale factor to make panel smaller (1.8x smaller than previous 0.4)
  const scale = 0.4 / 1.8;
  const baseWidth = 1.2;
  const baseHeight = 1.6;

  if (!leftController) return null;

  return (
    <group ref={panelRef}>
      <group scale={[scale, scale, scale]}>
          {/* Background panel */}
          <mesh>
            <planeGeometry args={[baseWidth, baseHeight]} />
            <meshBasicMaterial 
              color="#ffffff" 
              opacity={0.95} 
              transparent 
            />
          </mesh>
          
          {/* Border frame */}
          {/* Top border */}
          <mesh position={[0, baseHeight / 2, -0.001]}>
            <planeGeometry args={[baseWidth + 0.02, 0.02]} />
            <meshBasicMaterial color="#e5e7eb" />
          </mesh>
          {/* Bottom border */}
          <mesh position={[0, -baseHeight / 2, -0.001]}>
            <planeGeometry args={[baseWidth + 0.02, 0.02]} />
            <meshBasicMaterial color="#e5e7eb" />
          </mesh>
          {/* Left border */}
          <mesh position={[-baseWidth / 2 - 0.01, 0, -0.001]}>
            <planeGeometry args={[0.02, baseHeight + 0.02]} />
            <meshBasicMaterial color="#e5e7eb" />
          </mesh>
          {/* Right border */}
          <mesh position={[baseWidth / 2 + 0.01, 0, -0.001]}>
            <planeGeometry args={[0.02, baseHeight + 0.02]} />
            <meshBasicMaterial color="#e5e7eb" />
          </mesh>

          {/* Title */}
          <Text
            position={[0, baseHeight / 2 - 0.05, 0.01]}
            fontSize={0.08}
            color="#1f2937"
            anchorX="center"
            anchorY="top"
            maxWidth={baseWidth - 0.1}
            fontWeight="bold"
          >
            Flight Details
          </Text>

          {/* Close button */}
          <Interactive onSelect={onClose}>
            <mesh position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.05, 0.01]}>
              <planeGeometry args={[0.08, 0.08]} />
              <meshBasicMaterial 
                color="#ef4444" 
                opacity={0.8} 
                transparent 
              />
            </mesh>
            <Text
              position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.05, 0.02]}
              fontSize={0.06}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              ×
            </Text>
          </Interactive>

          {/* Callsign */}
          <Text
            position={[0, baseHeight / 2 - 0.15, 0.01]}
            fontSize={0.06}
            color="#1f2937"
            anchorX="center"
            anchorY="top"
            maxWidth={baseWidth - 0.1}
            fontWeight="bold"
          >
            {flight.callsign}
          </Text>

          {/* Airline */}
          <Text
            position={[0, baseHeight / 2 - 0.23, 0.01]}
            fontSize={0.04}
            color="#4b5563"
            anchorX="center"
            anchorY="top"
            maxWidth={baseWidth - 0.1}
          >
            {flight.airline}
          </Text>

          {/* ICAO */}
          <Text
            position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.31, 0.01]}
            fontSize={0.035}
            color="#4b5563"
            anchorX="left"
            anchorY="top"
          >
            ICAO:
          </Text>
          <Text
            position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.31, 0.01]}
            fontSize={0.035}
            color="#1f2937"
            anchorX="right"
            anchorY="top"
          >
            {flight.icao24}
          </Text>

          {/* Position */}
          <Text
            position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.39, 0.01]}
            fontSize={0.035}
            color="#4b5563"
            anchorX="left"
            anchorY="top"
          >
            Position:
          </Text>
          <Text
            position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.39, 0.01]}
            fontSize={0.03}
            color="#1f2937"
            anchorX="right"
            anchorY="top"
          >
            {flight.gps.latitude.toFixed(3)}, {flight.gps.longitude.toFixed(3)}
          </Text>

          {/* Altitude */}
          <Text
            position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.47, 0.01]}
            fontSize={0.035}
            color="#4b5563"
            anchorX="left"
            anchorY="top"
          >
            Altitude:
          </Text>
          <Text
            position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.47, 0.01]}
            fontSize={0.035}
            color="#1f2937"
            anchorX="right"
            anchorY="top"
          >
            {formatAltitude(flight.gps.altitude)}
          </Text>

          {/* Speed */}
          <Text
            position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.55, 0.01]}
            fontSize={0.035}
            color="#4b5563"
            anchorX="left"
            anchorY="top"
          >
            Speed:
          </Text>
          <Text
            position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.55, 0.01]}
            fontSize={0.035}
            color="#1f2937"
            anchorX="right"
            anchorY="top"
          >
            {formatSpeed(flight.velocity)}
          </Text>

          {/* Heading */}
          <Text
            position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.63, 0.01]}
            fontSize={0.035}
            color="#4b5563"
            anchorX="left"
            anchorY="top"
          >
            Heading:
          </Text>
          <Text
            position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.63, 0.01]}
            fontSize={0.035}
            color="#1f2937"
            anchorX="right"
            anchorY="top"
          >
            {formatHeading(flight.heading)}
          </Text>

          {/* Distance */}
          <Text
            position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.71, 0.01]}
            fontSize={0.035}
            color="#4b5563"
            anchorX="left"
            anchorY="top"
          >
            Distance:
          </Text>
          <Text
            position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.71, 0.01]}
            fontSize={0.035}
            color="#1f2937"
            anchorX="right"
            anchorY="top"
          >
            {formatDistance(flight.distance)}
          </Text>

          {/* Elevation */}
          <Text
            position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.79, 0.01]}
            fontSize={0.035}
            color="#4b5563"
            anchorX="left"
            anchorY="top"
          >
            Elevation:
          </Text>
          <Text
            position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.79, 0.01]}
            fontSize={0.035}
            color="#1f2937"
            anchorX="right"
            anchorY="top"
          >
            {flight.elevation.toFixed(1)}°
          </Text>

          {/* Status */}
          <Text
            position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.87, 0.01]}
            fontSize={0.035}
            color="#4b5563"
            anchorX="left"
            anchorY="top"
          >
            Status:
          </Text>
          <Text
            position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.87, 0.01]}
            fontSize={0.035}
            color={flight.onGround ? "#6b7280" : "#10b981"}
            anchorX="right"
            anchorY="top"
          >
            {flight.onGround ? "On Ground" : "In Flight"}
          </Text>

          {/* Last Update */}
          <Text
            position={[0, -baseHeight / 2 + 0.1, 0.01]}
            fontSize={0.03}
            color="#6b7280"
            anchorX="center"
            anchorY="top"
          >
            Updated {formatLastUpdate(flight.lastUpdate)}
          </Text>
        </group>
    </group>
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

      {/* Flight objects - make them interactive in VR and desktop */}
      {filteredFlights.map((flight) => {
        const handleSelect = () => {
          console.log("Flight selected:", flight.callsign);
          // Toggle selection - click same flight to deselect
          if (selectedFlight?.id === flight.id) {
            onFlightSelect(null);
          } else {
            onFlightSelect(flight);
          }
        };

        return (
          <React.Fragment key={flight.id}>
            {/* Interactive for VR mode */}
            {isPresenting ? (
              <Interactive onSelect={handleSelect}>
                <ARWaypoint
                  flight={flight}
                  isSelected={selectedFlight?.id === flight.id}
                  onClick={handleSelect}
                />
              </Interactive>
            ) : (
              // Regular onClick for desktop mode
              <ARWaypoint
                flight={flight}
                isSelected={selectedFlight?.id === flight.id}
                onClick={handleSelect}
              />
            )}
            {config.enableTrajectories && <FlightTrajectory flight={flight} />}
          </React.Fragment>
        );
      })}

      {/* VR Info Panel - 3D panel visible in VR mode */}
      {isPresenting && selectedFlight && (
        <VRFlightInfoPanel 
          flight={selectedFlight} 
          onClose={() => onFlightSelect(null)} 
        />
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
