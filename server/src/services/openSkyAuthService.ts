import axios from 'axios'

const DEFAULT_AUTH_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'

interface TokenResponse {
  access_token: string
  expires_in?: number
  token_type?: string
}

export class OpenSkyAuthService {
  private accessToken: string | null = null
  private tokenExpiresAt = 0
  private refreshPromise: Promise<string | null> | null = null
  private readonly refreshBufferMs = 60_000 // refresh 60s before expiry
  private readonly credentialsProvided: boolean
  private lastAuthSuccessAt: number | null = null
  private lastAuthErrorAt: number | null = null
  private lastAuthErrorMessage: string | null = null

  constructor(
    private readonly clientId?: string,
    private readonly clientSecret?: string,
    private readonly authUrl: string = DEFAULT_AUTH_URL
  ) {
    this.credentialsProvided = !!(clientId && clientSecret)
  }

  hasCredentials(): boolean {
    return this.credentialsProvided
  }

  getStatus() {
    return {
      credentialsConfigured: this.credentialsProvided,
      lastAuthSuccessAt: this.lastAuthSuccessAt,
      lastAuthErrorAt: this.lastAuthErrorAt,
      lastAuthErrorMessage: this.lastAuthErrorMessage,
      tokenExpiresAt: this.tokenExpiresAt,
    }
  }

  /**
   * Returns an authorization header object if credentials are configured.
   * When client credentials are not provided, returns null so callers can proceed
   * without authentication (useful for legacy accounts or demo mode).
   */
  async getAuthorizationHeader(): Promise<Record<string, string> | null> {
    const token = await this.getAccessToken()
    if (!token) {
      return null
    }

    return {
      Authorization: `Bearer ${token}`,
    }
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret) {
      return null
    }

    const now = Date.now()

    if (this.accessToken && now < this.tokenExpiresAt - this.refreshBufferMs) {
      return this.accessToken
    }

    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.requestNewToken()
    return this.refreshPromise
  }

  private async requestNewToken(): Promise<string | null> {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId ?? '',
      client_secret: this.clientSecret ?? '',
    })

    try {
      const response = await axios.post<TokenResponse>(this.authUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10_000,
      })

      if (!response.data?.access_token) {
        throw new Error('OpenSky token response did not include access_token')
      }

      const expiresInSeconds = response.data.expires_in ?? 1800 // default 30 minutes
      this.accessToken = response.data.access_token
      this.tokenExpiresAt = Date.now() + expiresInSeconds * 1000
      this.lastAuthSuccessAt = Date.now()
      this.lastAuthErrorAt = null
      this.lastAuthErrorMessage = null

      return this.accessToken
    } catch (error) {
      this.lastAuthErrorAt = Date.now()
      this.lastAuthErrorMessage =
        error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      this.refreshPromise = null
    }
  }
}

