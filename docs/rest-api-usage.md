# REST API Usage Examples

This document provides real-world examples of how the REST API is used in the Aether VR Flight Tracker application.

## Overview

The Aether backend exposes several REST API endpoints that power the VR flight tracking experience. The client application (built with React and Three.js) consumes these APIs to fetch flight data, terrain elevation, and other information needed for the immersive 3D visualization.

## API Endpoints and Use Cases

### 1. Get Flights in Area - `/api/flights`

**Purpose**: Fetch all flights within a specified radius around a geographic location.

**Use Case**: This is the primary endpoint used to populate the 3D scene with aircraft. When a user is viewing a specific location in VR or on desktop, the client fetches all nearby flights to display them in real-time.

**Example from Client** (`client/src/App.tsx`):
```typescript
const refreshFlights = async () => {
  if (!userLocation) return;

  const response = await fetch(
    `${config.apiUrl}/api/flights?lat=${userLocation.latitude}&lon=${userLocation.longitude}&radius=${config.vr.maxDistance}`
  );

  if (response.ok) {
    const data = await response.json();
    if (data.success && data.data) {
      updateFlights(data.data);
      console.log(`Refreshed ${data.data.length} flights`);
    }
  }
};
```

**Parameters**:
- `lat` (required): Latitude of the center point
- `lon` (required): Longitude of the center point
- `radius` (optional): Search radius in kilometers (default: 100)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "icao24": "abc123",
      "callsign": "UAL123",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "altitude": 10000,
      "velocity": 450,
      "heading": 270
    }
  ],
  "count": 1,
  "timestamp": 1703001234567
}
```

**Real-World Example**: When a user "teleports" to San Francisco International Airport (SFO) in VR mode, the app calls:
```
GET /api/flights?lat=37.6213&lon=-122.3790&radius=50
```
This returns all flights within 50km of SFO, which are then rendered as 3D aircraft models in the virtual environment.

---

### 2. Get Elevation Data - `/api/elevation`

**Purpose**: Retrieve the terrain elevation at a specific latitude/longitude coordinate.

**Use Case**: When users select a new location to teleport to, the app needs to know the ground elevation to properly position the camera at a realistic height above terrain.

**Example from Client** (`client/src/components/LocationSelector.tsx`):
```typescript
click: async (e) => {
  const { lat, lng } = e.latlng;
  setSelectedPosition([lat, lng]);
  
  try {
    // Get elevation data
    const elevationResponse = await fetch(
      `${config.apiUrl}/api/elevation?lat=${lat}&lon=${lng}`
    );
    const elevationData = await elevationResponse.json();
    setElevation(elevationData.elevation);
  } catch (error) {
    console.error("Failed to get elevation:", error);
    setElevation(0); // Default to sea level
  }
}
```

**Parameters**:
- `lat` (required): Latitude
- `lon` (required): Longitude

**Response**:
```json
{
  "success": true,
  "latitude": 37.7749,
  "longitude": -122.4194,
  "elevation": 52.3,
  "timestamp": 1703001234567
}
```

**Real-World Example**: When a user clicks on Mount Everest in the location selector, the API returns:
```
GET /api/elevation?lat=27.9881&lon=86.9250
Response: { "elevation": 8848.86 } (meters above sea level)
```
The camera is then positioned appropriately above this elevation, ensuring the user doesn't spawn underground or floating in space.

---

### 3. Get Flight Trajectory - `/api/flights/:icao/trajectory`

**Purpose**: Retrieve historical position data for a specific aircraft to display its flight path.

**Use Case**: When a user selects a specific aircraft in VR (by pointing their controller at it), the app fetches the aircraft's recent trajectory to draw a colored line showing where it has been.

**Example from Client** (`client/src/components/CesiumScene.tsx`):
```typescript
const url = `${config.apiUrl}/api/flights/${selectedFlight.icao24}/trajectory?lat=${userLocation.latitude}&lon=${userLocation.longitude}&alt=${userLocation.altitude}`;

const response = await fetch(url);
const data = await response.json();

if (data.success && data.data) {
  setTrajectoryData(data.data);
  // Draw path in 3D scene
}
```

**Parameters**:
- `icao` (path parameter, required): 6-character ICAO24 aircraft identifier
- `lat` (query, required): User's latitude
- `lon` (query, required): User's longitude
- `alt` (query, optional): User's altitude

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "altitude": 9500,
      "timestamp": 1703001200000
    },
    {
      "latitude": 37.7850,
      "longitude": -122.4100,
      "altitude": 10000,
      "timestamp": 1703001260000
    }
  ],
  "count": 2,
  "timestamp": 1703001234567
}
```

**Real-World Example**: A user in VR points at an Emirates A380 flying over Dubai and clicks it. The app calls:
```
GET /api/flights/a6edec/trajectory?lat=25.2532&lon=55.3657&alt=10
```
The response contains the last 10-15 position points, which are rendered as a curved 3D line trailing behind the aircraft.

---

### 4. Get Flight Route Information - `/api/flights/route`

**Purpose**: Fetch departure and destination airport information for a flight based on its callsign.

**Use Case**: When displaying detailed information about a selected flight, the app shows where the plane is coming from and where it's going, along with scheduled times.

**Example from Client** (`client/src/components/FlightInfoPanel.tsx`):
```typescript
const fetchRoute = async () => {
  const params = new URLSearchParams({ callsign });
  const url = `${config.apiUrl}/api/flights/route?${params.toString()}`;
  const response = await fetch(url);

  if (response.ok) {
    const data = await response.json();
    if (data.success && data.data) {
      setRouteInfo(data.data);
      // Display origin → destination
    }
  }
};
```

**Parameters**:
- `callsign` (required): Flight callsign (e.g., "UAL123")

**Response**:
```json
{
  "success": true,
  "data": {
    "departure": {
      "iata": "LAX",
      "name": "Los Angeles International Airport"
    },
    "arrival": {
      "iata": "SFO",
      "name": "San Francisco International Airport"
    },
    "scheduledDeparture": "2024-01-01T14:00:00Z",
    "scheduledArrival": "2024-01-01T15:30:00Z"
  },
  "timestamp": 1703001234567
}
```

**Real-World Example**: User selects a United Airlines flight. The info panel shows:
```
UAL123: Los Angeles (LAX) → San Francisco (SFO)
Departed: 2:00 PM | Arriving: 3:30 PM
```

---

### 5. Cache Statistics - `/api/cache/stats`

**Purpose**: Monitor the health and performance of the backend caching layer.

**Use Case**: Used by developers and in the diagnostic dashboard to understand cache hit rates and ensure the system is performing efficiently.

**Example from Client** (`client/src/utils/diagnostic-test.ts`):
```typescript
const response = await fetch(`${config.apiUrl}/api/cache/stats`);
const stats = await response.json();

console.log(`Cache hit rate: ${stats.data.cache.hitRate}%`);
console.log(`Flights cached: ${stats.data.flight.totalFlights}`);
```

**Response**:
```json
{
  "success": true,
  "data": {
    "cache": {
      "hits": 1500,
      "misses": 100,
      "hitRate": 93.75,
      "size": 250
    },
    "flight": {
      "totalFlights": 1234,
      "lastUpdate": 1703001234567
    }
  },
  "timestamp": 1703001234567
}
```

**Real-World Example**: A developer notices slow performance and checks cache stats to see if the cache is effective. A low hit rate might indicate that the cache TTL is too short or that the radius of flight queries is too varied.

---

## Data Flow Example: Complete User Journey

Here's how the REST APIs work together when a user experiences the app:

1. **User Opens App**
   - Browser loads React client
   - Client requests user's current location from browser geolocation API

2. **Initial Flight Load**
   ```
   GET /api/flights?lat=40.7128&lon=-74.0060&radius=100
   ```
   - Returns ~50 flights around New York City
   - Client renders them as 3D models in the scene

3. **User Teleports to Tokyo**
   - User clicks Tokyo on the location selector
   ```
   GET /api/elevation?lat=35.6762&lon=139.6503
   → Response: { elevation: 40 }
   ```
   - Camera repositions to Tokyo at 40m elevation + offset

4. **New Flights Loaded**
   ```
   GET /api/flights?lat=35.6762&lon=139.6503&radius=100
   → Returns ~80 flights around Tokyo
   ```
   - Old NYC flights fade out, Tokyo flights fade in

5. **User Selects an ANA Flight**
   - User points VR controller at aircraft and triggers
   ```
   GET /api/flights/ja741a/trajectory?lat=35.6762&lon=139.6503&alt=100
   → Returns flight path
   ```
   - 3D trajectory line appears behind aircraft

6. **User Views Flight Details**
   ```
   GET /api/flights/route?callsign=ANA123
   → Returns: Tokyo Haneda (HND) → Osaka Kansai (KIX)
   ```
   - Info panel updates with route details

---

## Technical Implementation Notes

### Backend Architecture

The REST API is implemented in **Node.js** with **Express**. Key features:

- **Rate Limiting**: 600 requests per 15-minute window per IP
- **CORS**: Configured to allow requests from the React client
- **Compression**: Gzip compression for all responses
- **Caching**: In-memory cache to reduce load on external APIs (OpenSky Network)
- **Error Handling**: Consistent error responses with proper HTTP status codes

### External Data Sources

The REST APIs aggregate data from:

1. **OpenSky Network**: Real-time flight positions (ADS-B data)
2. **Open-Elevation API**: Terrain elevation data
3. **AviationStack API**: Flight route and schedule information

### Authentication

The server handles authentication to external APIs (OpenSky OAuth) transparently. Clients don't need credentials - they just call the Aether API endpoints.

---

## Development and Testing

To test these endpoints locally:

```bash
# Start the backend
cd server
npm run dev

# Example API calls
curl "http://localhost:8080/api/flights?lat=37.7749&lon=-122.4194&radius=50"
curl "http://localhost:8080/api/elevation?lat=37.7749&lon=-122.4194"
curl "http://localhost:8080/api/flights/abc123/trajectory?lat=37.7749&lon=-122.4194"
curl "http://localhost:8080/api/flights/route?callsign=UAL123"
curl "http://localhost:8080/api/cache/stats"
```

---

## Summary

The REST API serves as the backbone of the Aether VR Flight Tracker, providing:

- ✈️ **Real-time flight data** for immersive visualization
- 🌍 **Terrain elevation** for accurate camera positioning
- 📊 **Flight trajectories** for path visualization
- 🗺️ **Route information** for detailed flight context
- 📈 **Performance metrics** for system monitoring

Each endpoint is designed to support specific features in the VR/3D experience, from rendering aircraft models to displaying detailed telemetry panels when users interact with flights.
