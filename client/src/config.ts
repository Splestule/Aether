export const config = {
  apiUrl: (import.meta.env.VITE_NODE_ENV || 'development') === 'production'
    ? 'https://api.yourdomain.com' 
    : `http://${import.meta.env.VITE_LOCAL_IP || 'localhost'}:8080`,
  wsUrl: (import.meta.env.VITE_NODE_ENV || 'development') === 'production'
    ? 'wss://api.yourdomain.com'
    : `ws://${import.meta.env.VITE_LOCAL_IP || 'localhost'}:8080`,
  vr: {
    maxDistance: 100, // km
    updateInterval: 15000, // ms
    maxFlights: 50,
    enableTrajectories: true,
  },
  api: {
    timeout: 10000, // ms
    retryAttempts: 3,
  }
};