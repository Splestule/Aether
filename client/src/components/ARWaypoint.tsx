import { ProcessedFlight } from "@shared/src/types.js";
import { forwardRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { Interactive } from "@react-three/xr";

interface ARWaypointProps {
  flight: ProcessedFlight;
  isSelected: boolean;
  onClick: () => void;
  isVR?: boolean;
}

// Detect if device is mobile (touch device or small screen)
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 768
  );
};

export const ARWaypoint = forwardRef<THREE.Group, ARWaypointProps>(
  ({ flight, isSelected, onClick, isVR = false }, ref) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
      setIsMobile(isMobileDevice());
      const handleResize = () => setIsMobile(isMobileDevice());
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calculate distance from user (at origin) to plane in meters
    const distanceFromUser = Math.sqrt(
      flight.position.x * flight.position.x +
        flight.position.y * flight.position.y +
        flight.position.z * flight.position.z
    );

    // Scale sphere size - keep consistent size for visibility, but slightly larger for very far planes
    // Base size in meters
    const baseSize = 150;
    const distanceKm = distanceFromUser / 1000;

    // Use a much smaller distance multiplier to prevent distant planes from appearing larger
    // This ensures perspective is maintained - closer planes should appear larger
    // Only slightly increase size for very distant planes (beyond 50km) for clickability
    const distanceMultiplier =
      distanceKm > 50 ? Math.min(1.5, 1 + (distanceKm - 50) / 100) : 1;

    // Scale with altitude for high-flying planes (but less aggressive)
    const altitudeMultiplier = Math.max(
      1,
      Math.min(2, Math.sqrt(Math.abs(flight.position.y) / 5000))
    );
    const sphereSize = baseSize * distanceMultiplier * altitudeMultiplier;

    // Calculate altitude line properties
    const altitude = Math.abs(flight.position.y);
    const lineRadius = Math.max(2, Math.min(10, distanceKm * 0.3)); // Scale line thickness with distance
    const lineHeight = altitude;
    const lineCenterY = flight.position.y / 2;

    const fadeStartKm = 50;
    const fadeEndKm = 200;

    const baseOpacity = useMemo(() => {
      if (isSelected) return 1;
      if (distanceKm <= fadeStartKm) return 0.8;
      const clamped =
        (Math.min(distanceKm, fadeEndKm) - fadeStartKm) /
        (fadeEndKm - fadeStartKm);
      return Math.max(0.2, 0.8 - clamped * 0.6);
    }, [distanceKm, isSelected]);

    const lineOpacity = useMemo(() => {
      if (isSelected) return 0.9;
      return Math.max(0.15, baseOpacity * 0.75);
    }, [baseOpacity, isSelected]);

    return (
      <group ref={ref} position={[flight.position.x, 0, flight.position.z]}>
        {/* Altitude line from ground to plane - visible vertical line */}
        {lineHeight > 0 && (
          <mesh position={[0, lineCenterY, 0]}>
            <cylinderGeometry args={[lineRadius, lineRadius, lineHeight, 16]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={lineOpacity}
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
                  color={isSelected ? "#c6a0e8" : "#ffffff"}
                  transparent
                  opacity={baseOpacity}
                />
              </mesh>
            </group>
          </Interactive>
        ) : (
          <group position={[0, flight.position.y, 0]}>
            {/* Visible sphere */}
            <mesh
              onClick={isMobile ? undefined : onClick}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (!isMobile) {
                  document.body.style.cursor = "pointer";
                }
              }}
              onPointerOut={() => {
                if (!isMobile) {
                  document.body.style.cursor = "default";
                }
              }}
              raycast={isMobile ? () => null : undefined}
            >
              <sphereGeometry args={[sphereSize, 16, 16]} />
              <meshBasicMaterial
                color={isSelected ? "#c6a0e8" : "#ffffff"}
                transparent
                opacity={baseOpacity}
              />
            </mesh>
            {/* Large invisible hitbox for mobile devices - easier touch selection (rendered last to catch events) */}
            {isMobile && (
              <mesh
                visible={false}
                onClick={onClick}
                onPointerOver={(e) => {
                  e.stopPropagation();
                }}
              >
                <sphereGeometry args={[sphereSize * 2.5, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            )}
          </group>
        )}

      </group>
    );
  }
);
