import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import { Group } from "three";
import { ProcessedFlight } from "@shared/src/types.js";

interface ARWaypointProps {
  flight: ProcessedFlight;
  isSelected: boolean;
  onClick: () => void;
}

export function ARWaypoint({ flight, isSelected, onClick }: ARWaypointProps) {
  const groupRef = useRef<Group>(null);

  // Scale down coordinates for VR scene (divide by 1000 to convert meters to km, then scale down further)
  const scaleFactor = 0.1; // Scale down by 10x for better visibility
  const scaledPosition = {
    x: flight.position.x * scaleFactor,
    y: flight.position.y * scaleFactor,
    z: flight.position.z * scaleFactor,
  };

  // Debug logging
  console.log(
    "ARWaypoint: Rendering flight:",
    flight.callsign,
    "at position:",
    flight.position,
    "scaled to:",
    scaledPosition
  );

  // Gentle pulsing animation for AR visibility
  useFrame((state) => {
    if (groupRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      groupRef.current.scale.setScalar(scale);
    }
  });

  // Color based on altitude for AR
  const color =
    flight.gps.altitude < 3000
      ? "#10b981"
      : flight.gps.altitude < 8000
      ? "#f59e0b"
      : "#ef4444";

  return (
    <group
      ref={groupRef}
      position={[scaledPosition.x, scaledPosition.y, scaledPosition.z]}
      onClick={onClick}
    >
      {/* Main waypoint indicator */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? "#3b82f6" : color}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Outer ring for better visibility */}
      <mesh position={[0, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>

      {/* Altitude indicator line */}
      <mesh position={[0, -scaledPosition.y / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, Math.abs(scaledPosition.y), 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>

      {/* Flight label - always visible in AR */}
      <Billboard position={[0, 0.5, 0]}>
        <Text
          fontSize={0.2}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {flight.callsign}
        </Text>
      </Billboard>

      {/* Altitude label */}
      <Billboard position={[0, 0.3, 0]}>
        <Text
          fontSize={0.15}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {Math.round(flight.gps.altitude / 100) * 100}ft
        </Text>
      </Billboard>

      {/* Distance label */}
      <Billboard position={[0, 0.1, 0]}>
        <Text
          fontSize={0.15}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {Math.round(flight.distance)}km
        </Text>
      </Billboard>
    </group>
  );
}
