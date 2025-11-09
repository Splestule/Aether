import { Express } from 'express'
import { FlightService } from '../services/flightService'
import { ElevationService } from '../services/elevationService'
import { CacheService } from '../services/cacheService'
import { OpenSkyAuthService } from '../services/openSkyAuthService'
import { logger } from '../logger.js'

interface Services {
  flightService: FlightService
  elevationService: ElevationService
  cacheService: CacheService
  openSkyAuthService?: OpenSkyAuthService
}

export function setupRoutes(app: Express, services: Services) {
  const { flightService, elevationService, cacheService, openSkyAuthService } = services

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
      logger.error('E-API-001', 'Failed to fetch flights', error)
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
      logger.error('E-API-002', 'Failed to fetch elevation', error)
      res.status(500).json({ 
        error: 'Failed to fetch elevation',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Cache statistics
  app.get('/api/cache/stats', (req, res) => {
    try {
      const cacheStats = cacheService.getStats()
      const flightStats = flightService.getStats()

      res.json({
        success: true,
        data: {
          cache: cacheStats,
          flight: flightStats,
        },
        timestamp: Date.now(),
      })
    } catch (error) {
      logger.error('E-API-003', 'Failed to fetch cache statistics', error)
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
      logger.error('E-API-004', 'Failed to clear cache', error)
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
      logger.error('E-API-005', 'Failed to fetch flight trajectory', error)
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
      logger.error('E-API-006', 'Failed to fetch flight details', error)
      res.status(500).json({ 
        error: 'Failed to fetch flight details',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  app.post('/api/opensky/reconnect', async (req, res) => {
    if (!openSkyAuthService || !openSkyAuthService.hasCredentials()) {
      return res.status(400).json({
        success: false,
        message: 'OpenSky OAuth credentials are not configured.',
      })
    }

    try {
      const header = await openSkyAuthService.getAuthorizationHeader({ forceRefresh: true })
      if (header) {
        return res.json({
          success: true,
          message: 'Successfully refreshed OpenSky token.',
        })
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to obtain OpenSky token after forcing refresh.',
      })
    } catch (error) {
      logger.error('E-API-007', 'OpenSky reconnect failed', error)
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

}
