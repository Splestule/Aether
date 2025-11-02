import { ProcessedFlight } from "@shared/src/types.js";

interface ARWaypointProps {
  flight: ProcessedFlight;
  isSelected: boolean;
  onClick: () => void;
}

export function ARWaypoint({ flight, isSelected, onClick }: ARWaypointProps) {
  // Use position directly - it's already in VR space meters
  // Draw a line from ground (y=0) to the plane's altitude
  
  // Make sphere size scale with altitude for easier clicking at high altitudes
  // Higher planes need larger clickable areas
  const baseSize = 25;
  const altitudeMultiplier = Math.max(1, Math.sqrt(Math.abs(flight.position.y) / 1000)); // Scale with altitude
  const sphereSize = baseSize * altitudeMultiplier;
  const ringInnerRadius = sphereSize * 1.4;
  const ringOuterRadius = sphereSize * 1.6;
  
  return (
    <group position={[flight.position.x, 0, flight.position.z]}>
      {/* Altitude line from ground to plane - thinner, more like a line */}
      <mesh position={[0, flight.position.y / 2, 0]}>
        <cylinderGeometry args={[0.5, 0.5, Math.abs(flight.position.y), 8]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Minimalistic waypoint - clickable ball at plane altitude with size scaling */}
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

      {/* Small ring for better visibility when not selected */}
      {!isSelected && (
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
      )}
    </group>
  );
}
