import { useState, useCallback, useRef } from 'react';
import { ProcessedFlight, UserLocation } from '@shared/src/types.js';
import { extrapolatePosition, gpsToVRCoordinates } from '@shared/src/utils.js';

export function useFlights() {
  const [flights, setFlights] = useState<Map<string, ProcessedFlight>>(new Map());
  const lastUpdateRef = useRef<number>(0);

  const addFlight = useCallback((flight: ProcessedFlight) => {
    setFlights((prev) => {
      const newFlights = new Map(prev);
      newFlights.set(flight.id, flight);
      return newFlights;
    });
  }, []);

  const updateFlight = useCallback((flight: ProcessedFlight) => {
    setFlights((prev) => {
      const newFlights = new Map(prev);
      if (newFlights.has(flight.id)) {
        newFlights.set(flight.id, flight);
      }
      return newFlights;
    });
  }, []);

  const removeFlight = useCallback((flightId: string) => {
    setFlights((prev) => {
      const newFlights = new Map(prev);
      newFlights.delete(flightId);
      return newFlights;
    });
  }, []);

  const clearFlights = useCallback(() => {
    setFlights(new Map());
  }, []);

  const updateFlights = useCallback((newFlights: ProcessedFlight[]) => {
    const now = Date.now();
    lastUpdateRef.current = now;

    setFlights((prev) => {
      const updatedFlights = new Map(prev);

      // Update existing flights and add new ones
      // Note: Position history is now fetched from API, not stored locally
      newFlights.forEach((flight) => {
        const previous = updatedFlights.get(flight.id);
        updatedFlights.set(flight.id, {
          ...flight,
          lastTrajectoryRefresh: previous?.lastTrajectoryRefresh,
          positionHistory: previous?.positionHistory,
        });
      });

      // Remove flights that are no longer present (older than 30 seconds)
      const cutoffTime = now - 30000;
      Array.from(updatedFlights.values()).forEach((flight) => {
        if (flight.lastUpdate < cutoffTime) {
          updatedFlights.delete(flight.id);
        }
      });

      return updatedFlights;
    });
  }, []);

  const getFlightById = useCallback(
    (id: string): ProcessedFlight | undefined => {
      return flights.get(id);
    },
    [flights]
  );

  const getFlightsArray = useCallback((): ProcessedFlight[] => {
    return Array.from(flights.values());
  }, [flights]);

  const getFlightsByDistance = useCallback(
    (maxDistance: number): ProcessedFlight[] => {
      return Array.from(flights.values()).filter((flight) => flight.distance <= maxDistance);
    },
    [flights]
  );

  /**
   * Extrapolate flight positions based on heading and speed
   * Updates positions every 5 seconds without API calls
   * @param userLocation User's location for recalculating relative positions
   * @param timeDelta Time elapsed in seconds (default 5 seconds)
   * @param heightCoefficient Coefficient to apply to height conversion
   * @param distanceCoefficient Coefficient to apply to distance conversion
   */
  const extrapolatePositions = useCallback(
    (
      userLocation: UserLocation,
      timeDelta: number = 5,
      heightCoefficient: number = 1.0,
      distanceCoefficient: number = 1.0
    ) => {
      if (!userLocation) return;

      setFlights((prev) => {
        const updatedFlights = new Map(prev);

        updatedFlights.forEach((flight, id) => {
          const extrapolated = extrapolatePosition(
            flight,
            userLocation,
            timeDelta,
            heightCoefficient,
            distanceCoefficient
          );

          if (!extrapolated) {
            return;
          }

          const updatedFlight: ProcessedFlight = {
            ...flight,
            gps: extrapolated.gps,
            position: extrapolated.position,
            distance: extrapolated.distance,
            elevation: extrapolated.elevation,
            azimuth: extrapolated.azimuth,
            // Don't update lastUpdate timestamp - keep original API timestamp
          };

          updatedFlights.set(id, updatedFlight);
        });

        return updatedFlights;
      });
    },
    []
  );

  /**
   * Recalculate flight positions using new coefficients
   * This is called when coefficients change to update all existing flight positions
   */
  const recalculatePositions = useCallback(
    (userLocation: UserLocation, heightCoefficient: number, distanceCoefficient: number) => {
      if (!userLocation) return;

      setFlights((prev) => {
        const updatedFlights = new Map(prev);

        updatedFlights.forEach((flight, id) => {
          const newPosition = gpsToVRCoordinates(
            userLocation,
            flight.gps.latitude,
            flight.gps.longitude,
            flight.gps.altitude,
            heightCoefficient,
            distanceCoefficient
          );

          const updatedFlight: ProcessedFlight = {
            ...flight,
            position: newPosition,
          };

          updatedFlights.set(id, updatedFlight);
        });

        return updatedFlights;
      });
    },
    []
  );

  return {
    flights: getFlightsArray(),
    flightsMap: flights,
    addFlight,
    updateFlight,
    removeFlight,
    clearFlights,
    updateFlights,
    getFlightById,
    getFlightsByDistance,
    extrapolatePositions,
    recalculatePositions,
    lastUpdate: lastUpdateRef.current,
  };
}
