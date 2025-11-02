import { useMemo } from "react";
import { ProcessedFlight } from "@shared/src/types.js";

interface FlightTrajectoryProps {
  flight: ProcessedFlight;
}

export function FlightTrajectory({ flight }: FlightTrajectoryProps) {
  // Generate a simple trajectory line based on current position and heading
  // Stop at a reasonable distance, not infinity
  const trajectoryPoints = useMemo(() => {
    const points = [];
    const segmentLength = 500; // 500 meters per segment
    const numSegments = 15; // Reduced from 20 to make it shorter
    const maxDistance = 5000; // Stop at 5km

    // Start from current position
    let currentX = flight.position.x;
    let currentY = flight.position.y;
    let currentZ = flight.position.z;

    points.push(currentX, currentY, currentZ);

    // Extrapolate trajectory based on heading and velocity
    const headingRad = (flight.heading * Math.PI) / 180;
    let totalDistance = 0;

    for (let i = 1; i <= numSegments; i++) {
      // Stop if we've gone too far
      if (totalDistance >= maxDistance) break;
      
      // Calculate next position based on heading
      currentX += segmentLength * Math.sin(headingRad);
      currentZ += segmentLength * Math.cos(headingRad);

      // Keep altitude constant (planes fly at level altitude)
      currentY = flight.position.y;

      totalDistance += segmentLength;
      points.push(currentX, currentY, currentZ);
    }

    return new Float32Array(points);
  }, [flight.position, flight.heading, flight.velocity]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={trajectoryPoints.length / 3}
          array={trajectoryPoints}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.5}
        linewidth={3}
      />
    </line>
  );
}
