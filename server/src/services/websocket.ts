import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { FlightService } from './flightService.js'
import { CacheService } from './cacheService.js'
import { WSMessage, FlightUpdateMessage, FlightAddMessage, FlightRemoveMessage } from '@vr-flight-tracker/shared'
import { logger } from '../logger.js'

interface Services {
  flightService: FlightService
  cacheService: CacheService
}

interface ClientConnection {
  ws: WebSocket
  id: string
  lastPing: number
  subscriptions: Set<string>
}

export function setupWebSocket(wss: WebSocketServer, services: Services) {
  const { flightService, cacheService } = services
  const clients = new Map<string, ClientConnection>()
  let clientIdCounter = 0

  // Ping interval to keep connections alive
  const PING_INTERVAL = 30000 // 30 seconds
  const PING_TIMEOUT = 10000 // 10 seconds

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    logger.debug('WebSocket connection from', request.socket.remoteAddress)

    const clientId = `client_${++clientIdCounter}`
    const client: ClientConnection = {
      ws,
      id: clientId,
      lastPing: Date.now(),
      subscriptions: new Set(),
    }

    clients.set(clientId, client)
    logger.debug('WebSocket client connected', clientId)

    // Send welcome message
    sendToClient(client, {
      type: 'connection',
      data: { clientId, message: 'Connected to VR Flight Tracker' },
      timestamp: Date.now(),
    })

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString())
        await handleMessage(client, message)
      } catch (error) {
        logger.error('E-WS-001', 'Failed to handle WebSocket message', error)
        sendToClient(client, {
          type: 'error',
          data: { message: 'Invalid message format' },
          timestamp: Date.now(),
        })
      }
    })

    ws.on('pong', () => {
      client.lastPing = Date.now()
    })

    ws.on('close', () => {
      logger.debug('WebSocket client disconnected', clientId)
      clients.delete(clientId)
    })

    ws.on('error', (error) => {
      logger.error('E-WS-005', `WebSocket error for client ${clientId}`, error)
      clients.delete(clientId)
    })
  })

  // Handle incoming messages
  async function handleMessage(client: ClientConnection, message: WSMessage) {
    switch (message.type) {
      case 'request_flights':
        await handleFlightRequest(client, message.data)
        break

      case 'subscribe_flights':
        client.subscriptions.add('flights')
        sendToClient(client, {
          type: 'subscription',
          data: { subscribed: ['flights'] },
          timestamp: Date.now(),
        })
        break

      case 'unsubscribe_flights':
        client.subscriptions.delete('flights')
        sendToClient(client, {
          type: 'subscription',
          data: { unsubscribed: ['flights'] },
          timestamp: Date.now(),
        })
        break

      case 'ping':
        sendToClient(client, {
          type: 'pong',
          data: { timestamp: Date.now() },
          timestamp: Date.now(),
        })
        break

      default:
        logger.debug('WebSocket unknown message type', message.type)
        sendToClient(client, {
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` },
          timestamp: Date.now(),
        })
    }
  }

  // Handle flight requests
  async function handleFlightRequest(client: ClientConnection, data: any) {
    try {
      const { latitude, longitude, radius = 100 } = data

      if (!latitude || !longitude) {
        sendToClient(client, {
          type: 'error',
          data: { message: 'Missing latitude or longitude' },
          timestamp: Date.now(),
        })
        return
      }

      const flights = await flightService.getFlightsInArea(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius)
      )

      // Send flight updates to all subscribed clients
      const updateMessage: FlightUpdateMessage = {
        type: 'flight_update',
        data: flights,
        timestamp: Date.now(),
      }

      broadcastToSubscribers('flights', updateMessage)

    } catch (error) {
      logger.error('E-WS-002', 'Failed to handle flight request', error)
      sendToClient(client, {
        type: 'error',
        data: { message: 'Failed to fetch flights' },
        timestamp: Date.now(),
      })
    }
  }

  // Send message to specific client
  function sendToClient(client: ClientConnection, message: WSMessage) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message))
      } catch (error) {
      logger.error('E-WS-003', 'Failed to send WebSocket message', error)
        clients.delete(client.id)
      }
    }
  }

  // Broadcast message to all clients subscribed to a topic
  function broadcastToSubscribers(topic: string, message: WSMessage) {
    clients.forEach(client => {
      if (client.subscriptions.has(topic)) {
        sendToClient(client, message)
      }
    })
  }

  // Ping clients to keep connections alive
  setInterval(() => {
    const now = Date.now()
    clients.forEach((client, clientId) => {
      if (now - client.lastPing > PING_TIMEOUT) {
        logger.debug('Removing inactive WebSocket client', clientId)
        client.ws.terminate()
        clients.delete(clientId)
        return
      }

      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping()
      }
    })
  }, PING_INTERVAL)

  // Periodic flight updates for subscribed clients
  setInterval(async () => {
    if (clients.size === 0) return

    // Get a sample of active subscriptions to update
    const subscribedClients = Array.from(clients.values()).filter(
      client => client.subscriptions.has('flights')
    )

    if (subscribedClients.length === 0) return

    // For demo purposes, we'll update with a default location
    // In a real implementation, you'd track each client's location
    try {
      const flights = await flightService.getFlightsInArea(50.0755, 14.4378, 100) // Prague

      const updateMessage: FlightUpdateMessage = {
        type: 'flight_update',
        data: flights,
        timestamp: Date.now(),
      }

      broadcastToSubscribers('flights', updateMessage)
    } catch (error) {
      logger.error('E-WS-004', 'Periodic flight update failed', error)
    }
  }, 15000) // Update every 15 seconds

  logger.action('WebSocket setup', 'WebSocket server setup complete')
}
