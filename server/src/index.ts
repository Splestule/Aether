// © 2025 Aether Flight Tracker - All Rights Reserved
// Unauthorized copying of this file, via any medium is strictly prohibited
// Proprietary and confidential
// Author: Eduard Šimon

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'

import { setupRoutes } from './routes/index.js'
import { setupWebSocket } from './services/websocket.js'
import { FlightService } from './services/flightService.js'
import { ElevationService } from './services/elevationService.js'
import { CacheService } from './services/cacheService.js'
import { OpenSkyAuthService } from './services/openSkyAuthService.js'
import { BYOKAuthService } from './services/byokAuthService.js'
import { BYOKSessionService } from './services/byokSessionService.js'
import { AviationStackService } from './services/aviationStackService.js'
import { logger } from './logger.js'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

const PORT = parseInt(process.env.PORT || '8080', 10)
const HOST = '0.0.0.0'

const defaultDevOrigins = [
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:8080',
  `http://${process.env.LOCAL_IP}:3000`,
  `http://${process.env.LOCAL_IP}:4173`,
  `http://${process.env.LOCAL_IP}:8080`,
  /\.trycloudflare\.com$/,
]

const defaultProdOrigins = ['https://yourdomain.com']

const extraOrigins = (process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [...defaultProdOrigins, ...extraOrigins]
    : [...defaultDevOrigins, ...extraOrigins]

// Check if BYOK is enabled
const isBYOKEnabled = process.env.BYOK === 'true'

// Initialize services
const cacheService = new CacheService()
const elevationService = new ElevationService()

// Initialize BYOK services if enabled
let byokSessionService: BYOKSessionService | undefined
let byokAuthService: BYOKAuthService | undefined
let openSkyAuthService: OpenSkyAuthService | BYOKAuthService

if (isBYOKEnabled) {
  byokSessionService = new BYOKSessionService()
  byokAuthService = new BYOKAuthService(
    process.env.OPENSKY_CLIENT_ID,
    process.env.OPENSKY_CLIENT_SECRET,
    process.env.OPENSKY_AUTH_URL,
    byokSessionService
  )
  openSkyAuthService = byokAuthService
  logger.action('BYOK enabled', 'Bring Your Own Key feature is enabled')
} else {
  openSkyAuthService = new OpenSkyAuthService(
    process.env.OPENSKY_CLIENT_ID,
    process.env.OPENSKY_CLIENT_SECRET,
    process.env.OPENSKY_AUTH_URL
  )
}

const flightService = new FlightService(cacheService, openSkyAuthService)
const aviationStackService = new AviationStackService(cacheService)

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false,
}))

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'RateLimit-Policy']
}))

app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting
// BYK-aware rate limiting: 10 req/min without session, normal limits with session
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // If BYOK is enabled, check for session token
    if (isBYOKEnabled && byokSessionService) {
      const sessionToken = req.headers['x-session-token'] as string | undefined
      if (sessionToken && byokSessionService.hasValidSession(sessionToken)) {
        // User has valid session, use normal limits
        return 600
      }
      // No session or invalid session, use limited rate (10 req/min = 150 req/15min)
      return 150
    }
    // BYOK not enabled, use normal limits
    return 600
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    const path = req.path || ''
    // Allow frequent internal polling endpoints (e.g. dashboard health checks)
    if (path === '/cache/stats' || path === '/cache/stats/') {
      return true
    }
    // Skip rate limiting for rate limit status endpoint
    if (path === '/api/rate-limit/status' || path === '/api/rate-limit/status/') {
      return true
    }
    // In production, allow local loopback traffic more leniency
    // In development, we want rate limiting to work for testing
    if (process.env.NODE_ENV === 'production') {
      const ip = req.ip || ''
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
    }
    return false
  },
})
app.use('/api', limiter)

// Logging middleware for API requests
app.use((req, _res, next) => {
  if (req.path.startsWith('/api') && logger.isDebugMode()) {
    const debugDetails = {
      path: req.originalUrl || req.path,
      query: req.query,
      method: req.method,
    }
    logger.api(req.method || 'GET', req.path, `API ${req.method} ${req.originalUrl}`, debugDetails)
  }
  next()
})

app.get('/api/debug', (_req, res) => {
  res.json({ debug: logger.isDebugMode() })
})

app.post('/api/debug', (req, res) => {
  const { debug } = req.body || {}
  const enabled = Boolean(debug)
  logger.setDebugMode(enabled)
  res.json({ success: true, debug: logger.isDebugMode() })
})

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Setup routes
setupRoutes(app, {
  flightService,
  elevationService,
  cacheService,
  openSkyAuthService,
  aviationStackService,
  byokSessionService,
  isBYOKEnabled
})

// Setup WebSocket
setupWebSocket(wss, { flightService, cacheService })

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('E-500-000', `Request failed for ${req.method} ${req.originalUrl || req.path}`, err)
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

logger.action('Server starting', `Starting server on ${HOST}:${PORT}...`)

server.listen(PORT, HOST, () => {
  logger.action('Server ready', `🚀 VR Flight Tracker Server running on http://${process.env.LOCAL_IP}:${PORT}`)
  logger.action('WebSocket ready', `📡 WebSocket server ready for connections`)
  logger.action('Environment ready', `🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.action('Server listening', `🚀 Server listening on:
   - Local:   http://localhost:${PORT}
   - Network: http://${process.env.LOCAL_IP}:${PORT}
   - WS:      ws://${process.env.LOCAL_IP}:${PORT}`)
})


// Graceful shutdown
process.on('SIGINT', () => {
  logger.action('SIGINT received', 'SIGINT received, shutting down gracefully')
  if (byokSessionService) {
    byokSessionService.destroy()
  }
  server.close(() => {
    logger.action('Server closed', 'Server closed')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  logger.action('SIGTERM received', 'SIGTERM received, shutting down gracefully')
  if (byokSessionService) {
    byokSessionService.destroy()
  }
  server.close(() => {
    logger.action('Server closed', 'Server closed')
    process.exit(0)
  })
})
