import { useState, useCallback, useRef } from 'react'
import { ProcessedFlight, UserLocation } from '@shared/src/types.js'
import {
  gpsToVRCoordinates,
  calculateDistance,
  calculateElevation,
  calculateBearing,
} from '@shared/src/utils.js'

export function useFlights() {
  const [flights, setFlights] = useState<Map<string, ProcessedFlight>>(new Map())
  const lastUpdateRef = useRef<number>(0)

  const addFlight = useCallback((flight: ProcessedFlight) => {
    setFlights(prev => {
      const newFlights = new Map(prev)
      newFlights.set(flight.id, flight)
      return newFlights
    })
  }, [])

  const updateFlight = useCallback((flight: ProcessedFlight) => {
    setFlights(prev => {
      const newFlights = new Map(prev)
      if (newFlights.has(flight.id)) {
        newFlights.set(flight.id, flight)
      }
      return newFlights
    })
  }, [])

  const removeFlight = useCallback((flightId: string) => {
    setFlights(prev => {
      const newFlights = new Map(prev)
      newFlights.delete(flightId)
      return newFlights
    })
  }, [])

  const clearFlights = useCallback(() => {
    setFlights(new Map())
  }, [])

  const updateFlights = useCallback((newFlights: ProcessedFlight[]) => {
    const now = Date.now()
    lastUpdateRef.current = now

    setFlights(prev => {
      const updatedFlights = new Map(prev)
      
      // Update existing flights and add new ones
      // Note: Position history is now fetched from API, not stored locally
      newFlights.forEach(flight => {
        updatedFlights.set(flight.id, flight)
      })

      // Remove flights that are no longer present (older than 30 seconds)
      const cutoffTime = now - 30000
      Array.from(updatedFlights.values()).forEach(flight => {
        if (flight.lastUpdate < cutoffTime) {
          updatedFlights.delete(flight.id)
        }
      })

      return updatedFlights
    })
  }, [])

  const getFlightById = useCallback((id: string): ProcessedFlight | undefined => {
    return flights.get(id)
  }, [flights])

  const getFlightsArray = useCallback((): ProcessedFlight[] => {
    return Array.from(flights.values())
  }, [flights])

  const getFlightsByDistance = useCallback((maxDistance: number): ProcessedFlight[] => {
    return Array.from(flights.values()).filter(flight => flight.distance <= maxDistance)
  }, [flights])

  /**
   * Extrapolate flight positions based on heading and speed
   * Updates positions every 5 seconds without API calls
   * @param userLocation User's location for recalculating relative positions
   * @param timeDelta Time elapsed in seconds (default 5 seconds)
   */
  const extrapolatePositions = useCallback((userLocation: UserLocation, timeDelta: number = 5) => {
    if (!userLocation) return

    setFlights(prev => {
      const updatedFlights = new Map(prev)
      
      // Constants for coordinate conversion
      const METERS_PER_DEGREE_LAT = 111320 // meters per degree of latitude
      
      updatedFlights.forEach((flight, id) => {
        // Skip flights on ground or with no velocity
        if (flight.onGround || flight.velocity <= 0) {
          return
        }

        // Calculate distance traveled in meters
        const distanceTraveled = flight.velocity * timeDelta // m/s * seconds = meters

        // Convert heading from degrees to radians
        // Heading: 0° = North, 90° = East, 180° = South, 270° = West
        const headingRad = (flight.heading * Math.PI) / 180

        // Calculate new GPS coordinates
        // North component: cos(heading) gives North-South movement
        // East component: sin(heading) gives East-West movement
        const latChange = (distanceTraveled * Math.cos(headingRad)) / METERS_PER_DEGREE_LAT
        const latRad = (flight.gps.latitude * Math.PI) / 180
        const lonChange = (distanceTraveled * Math.sin(headingRad)) / (METERS_PER_DEGREE_LAT * Math.cos(latRad))

        // Update GPS coordinates (keep altitude unchanged)
        const newLat = flight.gps.latitude + latChange
        const newLon = flight.gps.longitude + lonChange
        const altitude = flight.gps.altitude // Keep altitude unchanged

        // Recalculate derived values
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          newLat,
          newLon
        )

        const vrPosition = gpsToVRCoordinates(
          userLocation,
          newLat,
          newLon,
          altitude
        )

        const elevation = calculateElevation(
          userLocation,
          newLat,
          newLon,
          altitude
        )

        const azimuth = calculateBearing(
          userLocation.latitude,
          userLocation.longitude,
          newLat,
          newLon
        )

        // Create updated flight object
        const updatedFlight: ProcessedFlight = {
          ...flight,
          gps: {
            latitude: newLat,
            longitude: newLon,
            altitude: altitude,
          },
          position: vrPosition,
          distance,
          elevation,
          azimuth,
          // Don't update lastUpdate timestamp - keep original API timestamp
        }

        updatedFlights.set(id, updatedFlight)
      })

      return updatedFlights
    })
  }, [])

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
    lastUpdate: lastUpdateRef.current,
  }
}
