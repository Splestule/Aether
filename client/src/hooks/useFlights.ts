import { useState, useCallback, useRef } from 'react'
import { ProcessedFlight } from '@shared/src/types.js'

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
    lastUpdate: lastUpdateRef.current,
  }
}
