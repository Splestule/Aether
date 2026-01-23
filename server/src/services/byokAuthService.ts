// © 2025 Aether Flight Tracker - All Rights Reserved
// Unauthorized copying of this file, via any medium is strictly prohibited
// Proprietary and confidential
// Author: Eduard Šimon

import { OpenSkyAuthService } from './openSkyAuthService.js';
import { BYOKSessionService } from './byokSessionService.js';

/**
 * BYOK Auth Service manages OpenSky authentication for both server and user sessions.
 * When a session token is provided, it uses user credentials from the session.
 * Otherwise, it falls back to server credentials.
 */
export class BYOKAuthService {
  private sessionAuthServices: Map<string, OpenSkyAuthService> = new Map();
  private readonly serverAuthService: OpenSkyAuthService;

  constructor(
    serverClientId?: string,
    serverClientSecret?: string,
    serverAuthUrl?: string,
    private sessionService?: BYOKSessionService
  ) {
    // Create server auth service (always available)
    this.serverAuthService = new OpenSkyAuthService(
      serverClientId,
      serverClientSecret,
      serverAuthUrl
    );
  }

  /**
   * Get authorization header for a request.
   * If sessionToken is provided and valid, uses user credentials.
   * Otherwise, uses server credentials.
   */
  async getAuthorizationHeader(
    sessionToken?: string,
    options?: { forceRefresh?: boolean }
  ): Promise<Record<string, string> | null> {
    // If no session token, use server credentials
    if (!sessionToken || !this.sessionService) {
      return this.serverAuthService.getAuthorizationHeader(options);
    }

    // Check if session is valid
    const session = this.sessionService.getSession(sessionToken);
    if (!session) {
      // Session invalid or expired, fall back to server credentials
      return this.serverAuthService.getAuthorizationHeader(options);
    }

    // Get or create auth service for this session
    let authService = this.sessionAuthServices.get(sessionToken);
    if (!authService) {
      authService = new OpenSkyAuthService(session.clientId, session.clientSecret);
      this.sessionAuthServices.set(sessionToken, authService);
    }

    return authService.getAuthorizationHeader(options);
  }

  /**
   * Check if credentials are available (either server or session)
   */
  hasCredentials(sessionToken?: string): boolean {
    if (!sessionToken || !this.sessionService) {
      return this.serverAuthService.hasCredentials();
    }

    const session = this.sessionService.getSession(sessionToken);
    if (!session) {
      return this.serverAuthService.hasCredentials();
    }

    // Session exists, credentials are available
    return true;
  }

  /**
   * Get auth status for a session or server
   */
  getStatus(sessionToken?: string) {
    if (!sessionToken || !this.sessionService) {
      return this.serverAuthService.getStatus();
    }

    const session = this.sessionService.getSession(sessionToken);
    if (!session) {
      return this.serverAuthService.getStatus();
    }

    const authService = this.sessionAuthServices.get(sessionToken);
    if (!authService) {
      return {
        credentialsConfigured: true,
        lastAuthSuccessAt: null,
        lastAuthErrorAt: null,
        lastAuthErrorMessage: null,
        tokenExpiresAt: null,
      };
    }

    return authService.getStatus();
  }

  /**
   * Invalidate token for a session or server
   */
  invalidateToken(sessionToken?: string): void {
    if (!sessionToken || !this.sessionService) {
      this.serverAuthService.invalidateToken();
      return;
    }

    const authService = this.sessionAuthServices.get(sessionToken);
    if (authService) {
      authService.invalidateToken();
    }
  }

  /**
   * Clean up auth service for a deleted session
   */
  cleanupSession(sessionToken: string): void {
    this.sessionAuthServices.delete(sessionToken);
  }

  /**
   * Validate user credentials by attempting to get a token
   */
  async validateCredentials(clientId: string, clientSecret: string): Promise<boolean> {
    try {
      const testAuthService = new OpenSkyAuthService(clientId, clientSecret);
      await testAuthService.getAuthorizationHeader();
      return true;
    } catch (error) {
      return false;
    }
  }
}
