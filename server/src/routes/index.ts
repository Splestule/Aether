import { Express, Request } from 'express'
import { FlightService } from '../services/flightService'
import { ElevationService } from '../services/elevationService'
import { CacheService } from '../services/cacheService'
import { OpenSkyAuthService } from '../services/openSkyAuthService'
import { BYOKAuthService } from '../services/byokAuthService.js'
import { BYOKSessionService } from '../services/byokSessionService.js'
import { AviationStackService } from '../services/aviationStackService.js'
import { logger } from '../logger.js'

interface Services {
  flightService: FlightService
  elevationService: ElevationService
  cacheService: CacheService
  openSkyAuthService?: OpenSkyAuthService | BYOKAuthService
  aviationStackService?: AviationStackService
  byokSessionService?: BYOKSessionService
  isBYOKEnabled?: boolean
}

/**
 * Extract session token from request headers
 */
function getSessionToken(req: Request): string | undefined {
  return (req.headers['x-session-token'] as string) || 
         (req.headers['authorization']?.startsWith('Bearer ') 
           ? req.headers['authorization'].substring(7) 
           : undefined)
}

export function setupRoutes(app: Express, services: Services) {
  const {
    flightService,
    elevationService,
    cacheService,
    openSkyAuthService,
    aviationStackService,
    byokSessionService,
    isBYOKEnabled,
  } = services

  // Rate limit status endpoint - must be defined early to be accessible
  app.get('/api/rate-limit/status', (req, res) => {
    try {
      const sessionToken = getSessionToken(req)
      const isLimited = isBYOKEnabled && byokSessionService && 
        (!sessionToken || !byokSessionService.hasValidSession(sessionToken))
      
      // Calculate rate limit info based on BYOK status
      const limit = isLimited ? 150 : 600 // 150 for limited (10/min = 150/15min), 600 for full
      const windowMs = 15 * 60 * 1000 // 15 minutes
      
      // Note: express-rate-limit doesn't expose current usage directly
      // We'll return the limit and window, client can track usage
      const now = Date.now()
      const resetTime = now + windowMs

      res.json({
        success: true,
        isLimited,
        limit,
        windowMs,
        resetTime: new Date(resetTime).toISOString(),
        resetTimestamp: resetTime,
      })
    } catch (error) {
      logger.error('E-API-012', 'Failed to get rate limit status', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get rate limit status',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

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

      const sessionToken = getSessionToken(req)
      const flights = await flightService.getFlightsInArea(
        latitude,
        longitude,
        radiusKm,
        sessionToken
      )

      // Check if there was an OpenSky error (stored in flightService)
      const lastError = (flightService as any).lastError
      
      res.json({
        success: true,
        data: flights,
        count: flights.length,
        timestamp: Date.now(),
        ...(lastError && { error: lastError }),
      })
    } catch (error) {
      logger.error('E-API-001', 'Failed to fetch flights', error)
      res.status(500).json({ 
        error: 'Failed to fetch flights',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  app.get('/api/flights/route', async (req, res) => {
    try {
      const { callsign } = req.query

      if (!callsign || typeof callsign !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid parameter: callsign',
        })
      }

      if (!aviationStackService) {
        return res.status(503).json({
          error: 'AviationStack integration is not configured',
        })
      }

      const routeInfo = await aviationStackService.getRouteByCallsign(callsign)

      if (!routeInfo) {
        return res.status(404).json({
          error: 'Route not found for provided callsign',
        })
      }

      res.json({
        success: true,
        data: routeInfo,
        timestamp: Date.now(),
      })
    } catch (error) {
      logger.error('E-API-008', 'Failed to fetch flight route', error)
      res.status(500).json({
        error: 'Failed to fetch flight route',
        message: error instanceof Error ? error.message : 'Unknown error',
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
      const sessionToken = getSessionToken(req)
      const flightStats = flightService.getStats(sessionToken)

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

      const sessionToken = getSessionToken(req)
      const trajectory = await flightService.getFlightTrajectory(icao, userLocation, sessionToken)

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

      const sessionToken = getSessionToken(req)
      const flight = await flightService.getFlightByIcao(icao, sessionToken)

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
    const sessionToken = getSessionToken(req)
    const authService = isBYOKEnabled && byokSessionService && sessionToken
      ? (openSkyAuthService as BYOKAuthService)
      : (openSkyAuthService as OpenSkyAuthService)

    if (!authService || !authService.hasCredentials(sessionToken)) {
      return res.status(400).json({
        success: false,
        message: 'OpenSky OAuth credentials are not configured.',
      })
    }

    try {
      const header = isBYOKEnabled && sessionToken
        ? await (authService as BYOKAuthService).getAuthorizationHeader(sessionToken, { forceRefresh: true })
        : await (authService as OpenSkyAuthService).getAuthorizationHeader({ forceRefresh: true })
      
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

  // BYOK API Routes
  if (isBYOKEnabled && byokSessionService) {
    // POST /api/opensky/credentials - Submit user credentials and get session token
    app.post('/api/opensky/credentials', async (req, res) => {
      try {
        const { clientId, clientSecret } = req.body

        if (!clientId || !clientSecret) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: clientId, clientSecret',
          })
        }

        // Validate credentials by attempting to get a token
        const byokAuthService = openSkyAuthService as BYOKAuthService
        const isValid = await byokAuthService.validateCredentials(clientId, clientSecret)

        if (!isValid) {
          return res.status(401).json({
            success: false,
            error: 'Invalid OpenSky credentials',
          })
        }

        // Create session
        const sessionToken = byokSessionService.createSession(clientId, clientSecret)

        res.json({
          success: true,
          sessionToken,
          message: 'Credentials validated and session created',
        })
      } catch (error) {
        logger.error('E-API-009', 'Failed to create BYOK session', error)
        res.status(500).json({
          success: false,
          error: 'Failed to create session',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    // GET /api/opensky/status - Get BYOK status and session info
    app.get('/api/opensky/status', (req, res) => {
      try {
        const sessionToken = getSessionToken(req)
        const hasSession = sessionToken ? byokSessionService.hasValidSession(sessionToken) : false

        res.json({
          success: true,
          byokEnabled: true,
          hasSession,
          sessionActive: hasSession,
        })
      } catch (error) {
        logger.error('E-API-010', 'Failed to get BYOK status', error)
        res.status(500).json({
          success: false,
          error: 'Failed to get status',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    // DELETE /api/opensky/credentials - Remove user session
    app.delete('/api/opensky/credentials', (req, res) => {
      try {
        const sessionToken = getSessionToken(req)

        if (!sessionToken) {
          return res.status(400).json({
            success: false,
            error: 'No session token provided',
          })
        }

        const deleted = byokSessionService.deleteSession(sessionToken)
        
        // Clean up auth service instance
        if (deleted && openSkyAuthService instanceof BYOKAuthService) {
          openSkyAuthService.cleanupSession(sessionToken)
        }

        res.json({
          success: true,
          message: 'Session deleted successfully',
        })
      } catch (error) {
        logger.error('E-API-011', 'Failed to delete BYOK session', error)
        res.status(500).json({
          success: false,
          error: 'Failed to delete session',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  } else {
    // GET /api/opensky/status - Return BYOK disabled status
    app.get('/api/opensky/status', (_req, res) => {
      res.json({
        success: true,
        byokEnabled: false,
        hasSession: false,
        sessionActive: false,
      })
    })
  }

}
