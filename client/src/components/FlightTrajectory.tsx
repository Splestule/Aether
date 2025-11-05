import { useState, useEffect, useMemo } from "react";
import { ProcessedFlight, UserLocation } from "@shared/src/types.js";
import { config } from "../config";

interface FlightTrajectoryProps {
  flight: ProcessedFlight;
  userLocation: UserLocation;
}

interface TrajectoryPoint {
  timestamp: number;
  position: { x: number; y: number; z: number };
  gps: { latitude: number; longitude: number; altitude: number };
}

export function FlightTrajectory({ flight, userLocation }: FlightTrajectoryProps) {
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch trajectory data from API when flight changes
  useEffect(() => {
    const fetchTrajectory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${config.apiUrl}/api/flights/${flight.icao24}/trajectory?lat=${userLocation.latitude}&lon=${userLocation.longitude}&alt=${userLocation.altitude || 0}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setTrajectoryData(data.data);
          } else {
            setTrajectoryData([]);
          }
        } else {
          console.warn('Failed to fetch trajectory data:', response.status);
          setTrajectoryData([]);
        }
      } catch (error) {
        console.error('Error fetching trajectory:', error);
        setTrajectoryData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrajectory();
  }, [flight.icao24, userLocation.latitude, userLocation.longitude, userLocation.altitude]);

  // Convert trajectory data to points array
  const trajectoryPoints = useMemo(() => {
    if (trajectoryData.length === 0) {
      return new Float32Array(0);
    }

    const points: number[] = [];

    // Add all trajectory points in order
    trajectoryData.forEach(point => {
      points.push(
        point.position.x,
        point.position.y,
        point.position.z
      );
    });

    // Add current position last (most recent)
    points.push(
      flight.position.x,
      flight.position.y,
      flight.position.z
    );

    return new Float32Array(points);
  }, [trajectoryData, flight.position]);

  // Don't render if there's no trajectory data or still loading
  if (trajectoryPoints.length === 0 || isLoading) {
    return null;
  }

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
        opacity={0.6}
        linewidth={2}
      />
    </line>
  );
}
