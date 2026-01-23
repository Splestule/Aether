const isLocalhost =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const isCloudflare = window.location.hostname.includes('trycloudflare.com');

const getApiUrl = () => {
  // Explicit env var takes precedence
  if (import.meta.env.VITE_API_URL) {
    console.log('Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }

  // If running on localhost, use local server
  if (isLocalhost) {
    console.log('Detected localhost, using local API');
    return 'http://localhost:8080';
  }

  // If on Cloudflare, must use env var (error if not set)
  if (isCloudflare) {
    console.error('⚠️ Running on Cloudflare but VITE_API_URL not set!');
    alert('Configuration Error: Server URL not configured for remote access');
    return 'http://localhost:8080'; // Fallback (won't work)
  }

  return 'http://localhost:8080';
};

const getWsUrl = () => {
  // Explicit env var takes precedence
  if (import.meta.env.VITE_WS_URL) {
    console.log('Using VITE_WS_URL:', import.meta.env.VITE_WS_URL);
    return import.meta.env.VITE_WS_URL;
  }

  // If running on localhost, use local server
  if (isLocalhost) {
    console.log('Detected localhost, using local WebSocket');
    return 'ws://localhost:8080';
  }

  // If on Cloudflare, must use env var (error if not set)
  if (isCloudflare) {
    console.error('⚠️ Running on Cloudflare but VITE_WS_URL not set!');
    alert('Configuration Error: WebSocket URL not configured for remote access');
    return 'ws://localhost:8080'; // Fallback (won't work)
  }

  return 'ws://localhost:8080';
};

export const config = {
  apiUrl: getApiUrl(),
  wsUrl: getWsUrl(),
  vr: {
    maxDistance: 100, // km - limit fetch to nearby planes
    updateInterval: 15000, // ms
    maxFlights: 100, // increased to handle more flights
    enableTrajectories: true,
  },
  api: {
    timeout: 10000, // ms
    retryAttempts: 3,
  },
};

/**
 * Check if BYOK (Bring Your Own Key) is enabled on the server
 */
export async function checkBYOKStatus(): Promise<{
  byokEnabled: boolean;
  hasSession: boolean;
  sessionActive: boolean;
}> {
  try {
    const sessionToken = getSessionToken();
    const headers: HeadersInit = {};
    if (sessionToken) {
      headers['X-Session-Token'] = sessionToken;
    }
    const response = await fetch(`${config.apiUrl}/api/opensky/status`, { headers });
    if (response.ok) {
      const data = await response.json();
      return {
        byokEnabled: data.byokEnabled ?? false,
        hasSession: data.hasSession ?? false,
        sessionActive: data.sessionActive ?? false,
      };
    }
    return { byokEnabled: false, hasSession: false, sessionActive: false };
  } catch (error) {
    console.warn('Failed to check BYOK status:', error);
    return { byokEnabled: false, hasSession: false, sessionActive: false };
  }
}

/**
 * Get session token from localStorage
 */
export function getSessionToken(): string | null {
  try {
    return localStorage.getItem('byok_session_token');
  } catch (error) {
    console.warn('Failed to get session token from localStorage:', error);
    return null;
  }
}

/**
 * Save session token to localStorage
 */
export function saveSessionToken(token: string): void {
  try {
    localStorage.setItem('byok_session_token', token);
  } catch (error) {
    console.error('Failed to save session token to localStorage:', error);
  }
}

/**
 * Remove session token from localStorage
 */
export function removeSessionToken(): void {
  try {
    localStorage.removeItem('byok_session_token');
  } catch (error) {
    console.warn('Failed to remove session token from localStorage:', error);
  }
}

// Log configuration on load
console.log('🚀 Flight Tracker Config:', {
  hostname: window.location.hostname,
  isLocalhost,
  isCloudflare,
  apiUrl: config.apiUrl,
  wsUrl: config.wsUrl,
  env: {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_WS_URL: import.meta.env.VITE_WS_URL,
    VITE_NODE_ENV: import.meta.env.VITE_NODE_ENV,
  },
});
