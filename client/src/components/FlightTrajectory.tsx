import { useMemo } from "react";
import { ProcessedFlight } from "@shared/src/types.js";

interface FlightTrajectoryProps {
  flight: ProcessedFlight;
}

export function FlightTrajectory({ flight }: FlightTrajectoryProps) {
  // Generate a simple trajectory line based on current position and heading
  const trajectoryPoints = useMemo(() => {
    const points = [];
    const segmentLength = 0.5; // km per segment
    const numSegments = 20;

    // Start from current position
    let currentX = flight.position.x;
    let currentY = flight.position.y;
    let currentZ = flight.position.z;

    points.push(currentX, currentY, currentZ);

    // Extrapolate trajectory based on heading and velocity
    const headingRad = (flight.heading * Math.PI) / 180;
    const velocityKmh = flight.velocity * 3.6; // Convert m/s to km/h

    for (let i = 1; i <= numSegments; i++) {
      // Calculate next position based on heading and velocity
      const timeStep = (i * segmentLength) / velocityKmh; // hours
      const distanceStep = segmentLength;

      currentX += distanceStep * Math.sin(headingRad);
      currentZ += distanceStep * Math.cos(headingRad);

      // Slight descent over time (realistic flight path)
      currentY -= timeStep * 0.1; // Very gradual descent

      points.push(currentX, currentY, currentZ);
    }

    return new Float32Array(points);
  }, [flight.position, flight.heading, flight.velocity]);

  // Color based on altitude
  const color = useMemo(() => {
    if (flight.gps.altitude < 3000) return "#10b981"; // Green
    if (flight.gps.altitude < 8000) return "#f59e0b"; // Yellow
    return "#ef4444"; // Red
  }, [flight.gps.altitude]);

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
        color={color}
        transparent
        opacity={0.6}
        linewidth={2}
      />
    </line>
  );
}
