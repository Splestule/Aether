import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProcessedFlight, UserLocation } from "@shared/src/types.js";
import { config } from "../config";
import { CatmullRomCurve3, Vector3, Quaternion, MathUtils } from "three";

interface FlightTrajectoryProps {
  flight: ProcessedFlight;
  userLocation: UserLocation;
  isVR?: boolean;
}

interface TrajectoryPoint {
  timestamp: number;
  position: { x: number; y: number; z: number };
  gps: { latitude: number; longitude: number; altitude: number };
}

const HISTORY_LIMIT = 5; // five historical points
const REFRESH_CHECK_INTERVAL_MS = 30_000;
const MIDPOINT_MAX_AGE_MS = 6 * 60 * 1000;

function sortPoints(points: TrajectoryPoint[]): TrajectoryPoint[] {
  return [...points].sort((a, b) => a.timestamp - b.timestamp);
}

function trimHistory(points: TrajectoryPoint[]): TrajectoryPoint[] {
  const sorted = sortPoints(points);
  return sorted.slice(-HISTORY_LIMIT);
}

const MIN_POINT_SEPARATION_MS = 20_000; // 20 seconds

function dedupeClosePoints(points: TrajectoryPoint[]): TrajectoryPoint[] {
  if (points.length === 0) {
    return points;
  }

  const sorted = sortPoints(points);
  const filtered: TrajectoryPoint[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = filtered[filtered.length - 1];
    const current = sorted[i];
    if (current.timestamp - prev.timestamp >= MIN_POINT_SEPARATION_MS) {
      filtered.push(current);
    }
  }

  return filtered;
}

export function FlightTrajectory({
  flight,
  userLocation,
  isVR = false,
}: FlightTrajectoryProps) {
  const [history, setHistory] = useState<TrajectoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastRefreshRef = useRef<number | null>(null);
  const pendingPointRef = useRef<TrajectoryPoint | null>(null);

  const fetchTrajectory = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${config.apiUrl}/api/flights/${flight.icao24}/trajectory?lat=${
          userLocation.latitude
        }&lon=${userLocation.longitude}&alt=${userLocation.altitude || 0}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          const sorted = sortPoints(data.data);
          const limited = sorted.slice(-(HISTORY_LIMIT + 1));

          if (limited.length > HISTORY_LIMIT) {
            // keep newest API sample pending, older ones in history
            const pending = limited[limited.length - 1];
            const baseHistory = limited.slice(0, limited.length - 1);
            setHistory(trimHistory(dedupeClosePoints(baseHistory)));
            pendingPointRef.current = pending;
          } else {
            setHistory(trimHistory(dedupeClosePoints(limited)));
            pendingPointRef.current = null;
          }
        } else {
          setHistory([]);
          pendingPointRef.current = null;
        }
      } else {
        console.warn("Failed to fetch trajectory data:", response.status);
        setHistory([]);
        pendingPointRef.current = null;
      }
    } catch (error) {
      console.error("Error fetching trajectory:", error);
      setHistory([]);
      pendingPointRef.current = null;
    } finally {
      lastRefreshRef.current = Date.now();
      setIsLoading(false);
    }
  }, [
    flight.icao24,
    userLocation.latitude,
    userLocation.longitude,
    userLocation.altitude,
  ]);

  useEffect(() => {
    fetchTrajectory();
  }, [fetchTrajectory]);

  // Append buffered API samples when a newer update arrives
  useEffect(() => {
    if (!flight.lastUpdate) {
      return;
    }

    const pending = pendingPointRef.current;
    if (pending && pending.timestamp < flight.lastUpdate) {
      setHistory((prev) => trimHistory(dedupeClosePoints([...prev, pending])));
      pendingPointRef.current = null;
    }

    // Store the current API update as pending for the next cycle
    if (
      !pendingPointRef.current ||
      pendingPointRef.current.timestamp !== flight.lastUpdate
    ) {
      const candidate: TrajectoryPoint = {
        timestamp: flight.lastUpdate,
        position: { ...flight.position },
        gps: { ...flight.gps },
      };

      const lastHistorical = history.length
        ? history[history.length - 1]
        : null;

      if (
        !lastHistorical ||
        candidate.timestamp - lastHistorical.timestamp >=
          MIN_POINT_SEPARATION_MS
      ) {
        pendingPointRef.current = candidate;
      }
    }
  }, [flight.lastUpdate, flight.position, flight.gps, history]);

  // Periodically refresh to keep midpoint fresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (isLoading) return;

      const now = Date.now();
      const lastRefresh = lastRefreshRef.current;
      const midpointIndex = Math.max(history.length - 2, 0);
      const midpoint = history[midpointIndex];

      const midpointTooOld =
        midpoint && now - midpoint.timestamp >= MIDPOINT_MAX_AGE_MS;

      if (
        midpointTooOld ||
        !lastRefresh ||
        now - lastRefresh >= MIDPOINT_MAX_AGE_MS
      ) {
        fetchTrajectory();
      }
    }, REFRESH_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchTrajectory, history, isLoading]);

  const segments = useMemo(() => {
    if (history.length === 0) {
      return [];
    }

    const basePoints = history.map(
      (point) =>
        new Vector3(point.position.x, point.position.y, point.position.z)
    );

    const currentPosition = new Vector3(
      flight.position.x,
      flight.position.y,
      flight.position.z
    );

    basePoints.push(currentPosition);

    if (basePoints.length < 2) {
      return [];
    }

    const curve = new CatmullRomCurve3(basePoints, false, "centripetal");
    const sampleCount = Math.max(basePoints.length * 40, 80);
    const sampledPoints = curve.getPoints(sampleCount);

    // Ensure the trajectory ends exactly at the plane's current position
    // This prevents the curve from extending beyond the plane due to CatmullRom interpolation
    if (sampledPoints.length > 0) {
      sampledPoints[sampledPoints.length - 1] = currentPosition.clone();
    }

    const segmentsData = [];
    const segmentCount = sampledPoints.length - 1;

    for (let i = 0; i < segmentCount; i++) {
      const start = sampledPoints[i];
      const end = sampledPoints[i + 1];
      const direction = end.clone().sub(start);
      const length = direction.length();

      if (length < 1) continue;

      const midpoint = start.clone().add(end).multiplyScalar(0.5);
      const quaternion = new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        direction.clone().normalize()
      );

      const startProgress = i / segmentCount;
      const endProgress = (i + 1) / segmentCount;

      const thicknessFactor = isVR ? 2 : 1;
      const radiusStart =
        MathUtils.lerp(8, 28, startProgress) * thicknessFactor;
      const radiusEnd = MathUtils.lerp(8, 28, endProgress) * thicknessFactor;
      const opacity = MathUtils.lerp(0.15, 1, endProgress);

      segmentsData.push({
        key: i,
        position: midpoint.toArray() as [number, number, number],
        quaternion: [
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w,
        ] as [number, number, number, number],
        length,
        radiusStart,
        radiusEnd,
        opacity,
      });
    }

    return segmentsData;
  }, [history, flight.position.x, flight.position.y, flight.position.z, isVR]);

  if (isLoading || segments.length === 0) {
    return null;
  }

  return (
    <group>
      {segments.map((segment) => (
        <mesh
          key={segment.key}
          position={segment.position}
          quaternion={segment.quaternion}
        >
          <cylinderGeometry
            args={[
              segment.radiusStart,
              segment.radiusEnd,
              segment.length,
              12,
              1,
              false,
            ]}
          />
          <meshBasicMaterial
            color="#c6a0e8"
            transparent
            opacity={segment.opacity}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
