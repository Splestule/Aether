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

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

const PORT = parseInt(process.env.PORT || '8080', 10)
const HOST = '0.0.0.0'

// Initialize services
const cacheService = new CacheService()
const elevationService = new ElevationService()
const openSkyAuthService = new OpenSkyAuthService(
  process.env.OPENSKY_CLIENT_ID,
  process.env.OPENSKY_CLIENT_SECRET,
  process.env.OPENSKY_AUTH_URL
)
const flightService = new FlightService(cacheService, openSkyAuthService)

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false,
}))

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com']
    : [
        'http://localhost:3000',
        'http://localhost:8080',
        `http://${process.env.LOCAL_IP}:3000`,
        `http://${process.env.LOCAL_IP}:8080`,
        'https://recognised-examined-nicole-bras.trycloudflare.com',
        /\.trycloudflare\.com$/, // Allow all Cloudflare tunnels
      ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // allow up to 600 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    const path = req.path || ''
    // Allow frequent internal polling endpoints (e.g. dashboard health checks)
    if (path === '/cache/stats' || path === '/cache/stats/') {
      return true
    }
    // Allow local loopback traffic (dashboard + client) more leniency
    const ip = req.ip || ''
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
  },
})
app.use('/api', limiter)

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Setup routes
setupRoutes(app, { flightService, elevationService, cacheService, openSkyAuthService })

// Setup WebSocket
setupWebSocket(wss, { flightService, cacheService })

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

console.log(`Starting server on ${HOST}:${PORT}...`)

server.listen(PORT, HOST, () => {
  console.log(`🚀 VR Flight Tracker Server running on http://${process.env.LOCAL_IP}:${PORT}`)
  console.log(`📡 WebSocket server ready for connections`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🚀 Server listening on:`)
  console.log(`   - Local:   http://localhost:${PORT}`)
  console.log(`   - Network: http://${process.env.LOCAL_IP}:${PORT}`)
  console.log(`   - WS:      ws://${process.env.LOCAL_IP}:${PORT}`)
})


// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})
