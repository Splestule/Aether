const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';

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
    maxDistance: 200, // km - increased for larger fetch radius
    updateInterval: 15000, // ms
    maxFlights: 100, // increased to handle more flights
    enableTrajectories: true,
  },
  api: {
    timeout: 10000, // ms
    retryAttempts: 3,
  }
};

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
  }
});