import { Express } from 'express'
import { FlightService } from '../services/flightService'
import { ElevationService } from '../services/elevationService'
import { CacheService } from '../services/cacheService'

interface Services {
  flightService: FlightService
  elevationService: ElevationService
  cacheService: CacheService
}

export function setupRoutes(app: Express, services: Services) {
  const { flightService, elevationService, cacheService } = services

  // Flights API
  app.get('/api/flights', async (req, res) => {
    try {
      const { lat, lon, radius = 100 } = req.query
      
      if (!lat || !lon) {
        return res.status(400).json({ 
          error: 'Missing required parameters: lat, lon' 
        })
      }

      const latitude = parseFloat(lat as string)
      const longitude = parseFloat(lon as string)
      const radiusKm = parseFloat(radius as string)

      if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
        return res.status(400).json({ 
          error: 'Invalid parameters: lat, lon, radius must be numbers' 
        })
      }

      const flights = await flightService.getFlightsInArea(
        latitude,
        longitude,
        radiusKm
      )

      res.json({
        success: true,
        data: flights,
        count: flights.length,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error('Error fetching flights:', error)
      res.status(500).json({ 
        error: 'Failed to fetch flights',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Elevation API
  app.get('/api/elevation', async (req, res) => {
    try {
      const { lat, lon } = req.query
      
      if (!lat || !lon) {
        return res.status(400).json({ 
          error: 'Missing required parameters: lat, lon' 
        })
      }

      const latitude = parseFloat(lat as string)
      const longitude = parseFloat(lon as string)

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ 
          error: 'Invalid parameters: lat, lon must be numbers' 
        })
      }

      const elevation = await elevationService.getElevation(latitude, longitude)

      res.json({
        success: true,
        latitude,
        longitude,
        elevation,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error('Error fetching elevation:', error)
      res.status(500).json({ 
        error: 'Failed to fetch elevation',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Cache statistics
  app.get('/api/cache/stats', (req, res) => {
    try {
      const stats = cacheService.getStats()
      res.json({
        success: true,
        data: stats,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error('Error fetching cache stats:', error)
      res.status(500).json({ 
        error: 'Failed to fetch cache statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Clear cache
  app.delete('/api/cache', (req, res) => {
    try {
      cacheService.clear()
      res.json({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error('Error clearing cache:', error)
      res.status(500).json({ 
        error: 'Failed to clear cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Flight trajectory (historical positions) - must come before /api/flights/:icao to match first
  app.get('/api/flights/:icao/trajectory', async (req, res) => {
    try {
      const { icao } = req.params
      const { lat, lon, alt } = req.query
      
      if (!icao || icao.length !== 6) {
        return res.status(400).json({ 
          error: 'Invalid ICAO code' 
        })
      }

      if (!lat || !lon) {
        return res.status(400).json({ 
          error: 'Missing required parameters: lat, lon' 
        })
      }

      const latitude = parseFloat(lat as string)
      const longitude = parseFloat(lon as string)
      const altitude = alt ? parseFloat(alt as string) : 0

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ 
          error: 'Invalid parameters: lat, lon must be numbers' 
        })
      }

      const userLocation = {
        latitude,
        longitude,
        altitude,
      }

      const trajectory = await flightService.getFlightTrajectory(icao, userLocation)

      res.json({
        success: true,
        data: trajectory,
        count: trajectory.length,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error('Error fetching flight trajectory:', error)
      res.status(500).json({ 
        error: 'Failed to fetch flight trajectory',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Flight details by ICAO
  app.get('/api/flights/:icao', async (req, res) => {
    try {
      const { icao } = req.params
      
      if (!icao || icao.length !== 6) {
        return res.status(400).json({ 
          error: 'Invalid ICAO code' 
        })
      }

      const flight = await flightService.getFlightByIcao(icao)

      if (!flight) {
        return res.status(404).json({ 
          error: 'Flight not found' 
        })
      }

      res.json({
        success: true,
        data: flight,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error('Error fetching flight details:', error)
      res.status(500).json({ 
        error: 'Failed to fetch flight details',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

}
