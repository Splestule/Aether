import { ProcessedFlight } from "@shared/src/types.js";
import { forwardRef } from "react";
import * as THREE from "three";
import { Interactive } from "@react-three/xr";

interface ARWaypointProps {
  flight: ProcessedFlight;
  isSelected: boolean;
  onClick: () => void;
  isVR?: boolean;
}

export const ARWaypoint = forwardRef<THREE.Group, ARWaypointProps>(
  ({ flight, isSelected, onClick, isVR = false }, ref) => {
  // Calculate distance from user (at origin) to plane in meters
  const distanceFromUser = Math.sqrt(
    flight.position.x * flight.position.x + 
    flight.position.y * flight.position.y + 
    flight.position.z * flight.position.z
  );
  
  // Scale sphere size based on distance - larger spheres for farther planes
  // Base size in meters, scales with distance (km)
  const baseSize = 50; // Increased base size
  const distanceKm = distanceFromUser / 1000;
  // Scale factor: increases with distance so far planes are still clickable
  // For 10km: ~1.4x, for 50km: ~3.2x, for 100km: ~4.5x
  const distanceMultiplier = Math.max(1, Math.sqrt(distanceKm / 5));
  // Also scale with altitude for high-flying planes
  const altitudeMultiplier = Math.max(1, Math.sqrt(Math.abs(flight.position.y) / 2000));
  const sphereSize = baseSize * distanceMultiplier * altitudeMultiplier;
  const ringInnerRadius = sphereSize * 1.4;
  const ringOuterRadius = sphereSize * 1.6;
  
  // Calculate altitude line properties
  const altitude = Math.abs(flight.position.y);
  const lineRadius = Math.max(2, Math.min(10, distanceKm * 0.3)); // Scale line thickness with distance
  const lineHeight = altitude;
  const lineCenterY = flight.position.y / 2;
  
  return (
    <group ref={ref} position={[flight.position.x, 0, flight.position.z]}>
      {/* Altitude line from ground to plane - visible vertical line */}
      {lineHeight > 0 && (
        <mesh position={[0, lineCenterY, 0]}>
          <cylinderGeometry args={[lineRadius, lineRadius, lineHeight, 16]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.7}
          />
        </mesh>
      )}

      {/* Minimalistic waypoint - clickable ball at plane altitude with size scaling */}
      {isVR ? (
        <Interactive onSelect={onClick}>
          <group position={[0, flight.position.y, 0]}>
            {/* Large invisible collision mesh for easier VR selection */}
            <mesh visible={false}>
              <sphereGeometry args={[sphereSize * 3, 16, 16]} />
            </mesh>
            {/* Visible sphere */}
            <mesh>
              <sphereGeometry args={[sphereSize, 16, 16]} />
              <meshBasicMaterial
                color={isSelected ? "#60a5fa" : "#ffffff"}
                transparent
                opacity={isSelected ? 1.0 : 0.8}
              />
            </mesh>
          </group>
        </Interactive>
      ) : (
        <mesh 
          position={[0, flight.position.y, 0]}
          onClick={onClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "default";
          }}
        >
          <sphereGeometry args={[sphereSize, 16, 16]} />
          <meshBasicMaterial
            color={isSelected ? "#60a5fa" : "#ffffff"}
            transparent
            opacity={isSelected ? 1.0 : 0.8}
          />
        </mesh>
      )}

      {/* Small ring for better visibility when not selected */}
      {!isSelected && (
        isVR ? (
          <Interactive onSelect={onClick}>
            <group position={[0, flight.position.y, 0]}>
              {/* Large invisible collision mesh for easier VR selection */}
              <mesh visible={false}>
                <sphereGeometry args={[ringOuterRadius * 2, 16, 16]} />
              </mesh>
              {/* Visible ring */}
              <mesh>
                <ringGeometry args={[ringInnerRadius, ringOuterRadius, 32]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
              </mesh>
            </group>
          </Interactive>
        ) : (
          <mesh 
            position={[0, flight.position.y, 0]}
            onClick={onClick}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "default";
            }}
          >
            <ringGeometry args={[ringInnerRadius, ringOuterRadius, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
          </mesh>
        )
      )}
    </group>
  );
});
