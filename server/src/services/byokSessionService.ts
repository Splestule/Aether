// © 2025 Aether Flight Tracker - All Rights Reserved
// Unauthorized copying of this file, via any medium is strictly prohibited
// Proprietary and confidential
// Author: Eduard Šimon

import { randomUUID } from 'crypto'

interface SessionData {
  clientId: string
  clientSecret: string
  createdAt: number
  expiresAt: number
}

export class BYOKSessionService {
  private sessions: Map<string, SessionData> = new Map()
  private readonly sessionTTL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Start periodic cleanup of expired sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions()
    }, 60 * 60 * 1000) // Run cleanup every hour
  }

  /**
   * Create a new session with user credentials
   */
  createSession(clientId: string, clientSecret: string): string {
    const sessionToken = randomUUID()
    const now = Date.now()
    const expiresAt = now + this.sessionTTL

    this.sessions.set(sessionToken, {
      clientId,
      clientSecret,
      createdAt: now,
      expiresAt,
    })

    return sessionToken
  }

  /**
   * Get session data by token
   */
  getSession(sessionToken: string): SessionData | null {
    const session = this.sessions.get(sessionToken)
    
    if (!session) {
      return null
    }

    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionToken)
      return null
    }

    return session
  }

  /**
   * Delete a session
   */
  deleteSession(sessionToken: string): boolean {
    return this.sessions.delete(sessionToken)
  }

  /**
   * Check if a session exists and is valid
   */
  hasValidSession(sessionToken: string): boolean {
    return this.getSession(sessionToken) !== null
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired BYOK sessions`)
    }
  }

  /**
   * Get statistics about active sessions
   */
  getStats(): {
    activeSessions: number
    totalSessions: number
  } {
    const now = Date.now()
    let activeSessions = 0

    for (const session of this.sessions.values()) {
      if (now <= session.expiresAt) {
        activeSessions++
      }
    }

    return {
      activeSessions,
      totalSessions: this.sessions.size,
    }
  }

  /**
   * Cleanup on service shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.sessions.clear()
  }
}
