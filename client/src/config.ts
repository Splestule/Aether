export const config = {
    apiUrl: process.env.NODE_ENV === 'production' 
      ? 'https://api.yourdomain.com' 
      : `http://${process.env.VITE_LOCAL_IP || 'localhost'}:8080`,
    wsUrl: process.env.NODE_ENV === 'production'
      ? 'wss://api.yourdomain.com'
      : `ws://${process.env.VITE_LOCAL_IP || 'localhost'}:8080`,
    // Default VR settings
    vr: {
      maxDistance: 100, // km
      updateInterval: 15000, // ms
      maxFlights: 50,
      enableTrajectories: true,
    },
    // API settings
    api: {
      timeout: 10000, // ms
      retryAttempts: 3,
    }
  };