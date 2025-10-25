# 🚀 VR Flight Tracker

Real-time airplane visualization in VR space - a Flightradar24-like application designed for VR headsets (Meta Quest, WebXR compatible).

## ✨ Features

- **Interactive Map Selection**: Choose your viewing location on an interactive map
- **Real-time Flight Data**: Live aircraft positions from OpenSky Network API
- **3D VR Visualization**: See aircraft in 3D space around you in VR
- **Flight Information**: Detailed flight data with airline, altitude, speed, and trajectory
- **WebXR Support**: Compatible with Meta Quest and other WebXR devices
- **Performance Optimized**: Efficient rendering with LOD, caching, and batching

## 🏗️ Architecture

- **Frontend**: React + Three.js + WebXR (VR support)
- **Backend**: Node.js + Express + WebSocket
- **APIs**: OpenSky Network (flight data) + Open-Elevation (altitude data)
- **Caching**: In-memory caching with TTL
- **Real-time**: WebSocket for live updates

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- VR headset (optional, works in desktop mode too)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd vr-flight-tracker
   npm run install:all
   ```

2. **Set up environment variables:**
   ```bash
   cd server
   cp env.example .env
   # Edit .env if needed (defaults work for development)
   ```

3. **Start the development servers:**
   ```bash
   # From project root
   npm run dev
   ```

   This will start:
   - Backend server on http://localhost:8080
   - Frontend client on http://localhost:3000

### 🎮 Usage

1. **Open the application** in your browser: http://localhost:3000
2. **Select your location** by clicking on the interactive map
3. **View flights** in 3D space around your selected location
4. **Enter VR mode** (if you have a VR headset) by clicking the VR button
5. **Click on aircraft** to see detailed flight information

## 🛠️ Development

### Project Structure

```
vr-flight-tracker/
├── client/                 # React frontend with VR support
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/         # Custom React hooks
│   │   └── App.tsx        # Main application
│   └── package.json
├── server/                # Node.js backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   └── index.ts       # Server entry point
│   └── package.json
├── shared/                # Shared types and utilities
│   ├── types.ts          # TypeScript interfaces
│   ├── utils.ts          # Utility functions
│   └── package.json
└── package.json          # Root package.json
```

### Available Scripts

```bash
# Development
npm run dev              # Start both client and server
npm run dev:client       # Start only frontend
npm run dev:server       # Start only backend

# Building
npm run build            # Build both client and server
npm run build:client     # Build only frontend
npm run build:server     # Build only backend

# Installation
npm run install:all      # Install all dependencies
```

### API Endpoints

- `GET /api/flights?lat=x&lon=y&radius=z` - Get flights in area
- `GET /api/elevation?lat=x&lon=y` - Get elevation for coordinates
- `GET /api/flights/:icao` - Get specific flight by ICAO code
- `GET /api/cache/stats` - Get cache statistics
- `DELETE /api/cache` - Clear cache
- `WebSocket /ws` - Real-time flight updates

## 🎯 VR Setup

### Meta Quest Setup

1. **Enable Developer Mode** on your Quest headset
2. **Connect to your computer** via USB or WiFi
3. **Open the app** in the Quest browser
4. **Click "Enter VR"** to start the VR experience

### WebXR Requirements

- HTTPS connection (required for WebXR)
- Compatible browser (Chrome, Edge, Firefox)
- VR headset with WebXR support

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=8080
NODE_ENV=development
CACHE_TTL=300
RATE_LIMIT_MAX_REQUESTS=100
```

### VR Configuration

Adjust VR settings in the client:

```typescript
const config = {
  maxDistance: 100,        // km - max distance to show flights
  updateInterval: 15000,   // ms - flight update frequency
  maxFlights: 50,          // max number of flights to render
  enableTrajectories: true // show flight paths
}
```

## 📊 Performance

- **Caching**: API responses cached for 15 seconds
- **LOD**: Distance-based level of detail
- **Batching**: Efficient 3D rendering
- **Throttling**: API rate limiting
- **Delta Updates**: Only changed data transmitted

## 🚀 Deployment

### Production Build

```bash
npm run build
```

### Docker Deployment

```bash
# Build Docker image
docker build -t vr-flight-tracker .

# Run container
docker run -p 8080:8080 -p 3000:3000 vr-flight-tracker
```

### Environment Setup

For production, set these environment variables:

```env
NODE_ENV=production
PORT=8080
CORS_ORIGIN=https://yourdomain.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [OpenSky Network](https://opensky-network.org/) for flight data
- [Open-Elevation](https://open-elevation.com/) for elevation data
- [Three.js](https://threejs.org/) for 3D graphics
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) for React integration
- [WebXR](https://immersiveweb.dev/) for VR support

## 🐛 Troubleshooting

### Common Issues

1. **VR not working**: Ensure HTTPS and WebXR-compatible browser
2. **No flights showing**: Check API connectivity and location selection
3. **Performance issues**: Reduce maxDistance or maxFlights in config
4. **WebSocket errors**: Check server is running on port 8080

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

---

**Happy flying in VR! ✈️🥽**
