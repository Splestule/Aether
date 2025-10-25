import { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import { Group } from "three";
import { ProcessedFlight } from "@shared/src/types.js";
import {
  formatSpeed,
  formatAltitude,
  formatDistance,
} from "@shared/src/utils.js";
import { AircraftModel } from "./AircraftModel";

interface AircraftProps {
  flight: ProcessedFlight;
  isSelected: boolean;
  onClick: () => void;
}

export function Aircraft({ flight, isSelected, onClick }: AircraftProps) {
  const meshRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  // Calculate scale based on distance (closer = larger) - AR optimized
  const scale = useMemo(() => {
    const baseScale = 0.3; // Larger base scale for AR visibility
    const distanceScale = Math.max(0.2, 1 - flight.distance / 200); // Better distance scaling
    return baseScale * distanceScale;
  }, [flight.distance]);

  // Calculate color based on altitude
  const color = useMemo(() => {
    if (flight.onGround) return "#6b7280"; // Gray for ground
    if (flight.gps.altitude < 3000) return "#10b981"; // Green for low altitude
    if (flight.gps.altitude < 8000) return "#f59e0b"; // Yellow for medium altitude
    return "#ef4444"; // Red for high altitude
  }, [flight.gps.altitude, flight.onGround]);

  // Animate the aircraft
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y +=
        Math.sin(state.clock.elapsedTime * 2) * 0.001;

      // Rotate to face heading direction
      meshRef.current.rotation.y = (flight.heading * Math.PI) / 180;
    }
  });

  const handlePointerOver = () => setHovered(true);
  const handlePointerOut = () => setHovered(false);

  return (
    <group
      ref={meshRef}
      position={[flight.position.x, flight.position.y, flight.position.z]}
      scale={scale}
      onClick={onClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Aircraft model */}
      <AircraftModel
        color={isSelected ? "#3b82f6" : hovered ? "#60a5fa" : color}
        scale={1}
        animated={!flight.onGround}
      />

      {/* AR Waypoint indicator - always visible */}
      <mesh position={[0, 1.5, 0]}>
        <ringGeometry args={[0.3, 0.5, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>

      {/* Selection indicator */}
      {isSelected && (
        <mesh position={[0, 1, 0]}>
          <ringGeometry args={[0.5, 0.7, 16]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} />
        </mesh>
      )}

      {/* AR Distance indicator */}
      <mesh position={[0, 2, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>

      {/* Flight label */}
      <Billboard position={[0, 1.5, 0]}>
        <Text
          fontSize={0.3}
          color={isSelected ? "#3b82f6" : "#ffffff"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {flight.callsign}
        </Text>
      </Billboard>

      {/* Altitude label */}
      <Billboard position={[0, 1.2, 0]}>
        <Text
          fontSize={0.2}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {formatAltitude(flight.gps.altitude)}
        </Text>
      </Billboard>

      {/* Speed label */}
      <Billboard position={[0, 0.9, 0]}>
        <Text
          fontSize={0.2}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {formatSpeed(flight.velocity)}
        </Text>
      </Billboard>

      {/* Distance label */}
      <Billboard position={[0, 0.6, 0]}>
        <Text
          fontSize={0.2}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {formatDistance(flight.distance)}
        </Text>
      </Billboard>
    </group>
  );
}
