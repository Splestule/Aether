import { UserLocation, ProcessedFlight, FlightData } from './types';

/**
 * Convert GPS coordinates to VR space coordinates
 * @param userLocation User's GPS position
 * @param flightLat Flight's latitude
 * @param flightLon Flight's longitude
 * @param flightAlt Flight's altitude in meters
 * @returns VR space coordinates (x, y, z)
 */
export function gpsToVRCoordinates(
  userLocation: UserLocation,
  flightLat: number,
  flightLon: number,
  flightAlt: number
): { x: number; y: number; z: number } {
  // Calculate distance and bearing
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    flightLat,
    flightLon
  );
  
  const bearing = calculateBearing(
    userLocation.latitude,
    userLocation.longitude,
    flightLat,
    flightLon
  );

  // Convert to VR space (meters)
  // X: East-West (positive = East)
  // Y: Up-Down (positive = Up)
  // Z: North-South (positive = North)
  const x = distance * Math.sin((bearing * Math.PI) / 180);
  const z = distance * Math.cos((bearing * Math.PI) / 180);
  const y = flightAlt - userLocation.altitude;

  return { x, y, z };
}

/**
 * Calculate distance between two GPS points using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bearing between two GPS points
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360;
}

/**
 * Calculate elevation angle from user to flight
 */
export function calculateElevation(
  userLocation: UserLocation,
  flightLat: number,
  flightLon: number,
  flightAlt: number
): number {
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    flightLat,
    flightLon
  );
  
  const heightDiff = flightAlt - userLocation.altitude;
  const elevation = Math.atan(heightDiff / (distance * 1000)) * (180 / Math.PI);
  
  return Math.max(0, elevation); // Don't show flights below horizon
}

/**
 * Process raw flight data from OpenSky API
 */
export function processFlightData(
  flight: FlightData,
  userLocation: UserLocation
): ProcessedFlight | null {
  // Skip flights without position data
  if (!flight.longitude || !flight.latitude || !flight.baro_altitude) {
    return null;
  }

  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    flight.latitude,
    flight.longitude
  );

  // Skip flights too far away (configurable)
  if (distance > 100) { // 100km radius
    return null;
  }

  const vrPosition = gpsToVRCoordinates(
    userLocation,
    flight.latitude,
    flight.longitude,
    flight.baro_altitude
  );

  const elevation = calculateElevation(
    userLocation,
    flight.latitude,
    flight.longitude,
    flight.baro_altitude
  );

  const azimuth = calculateBearing(
    userLocation.latitude,
    userLocation.longitude,
    flight.latitude,
    flight.longitude
  );

  return {
    id: flight.icao24,
    callsign: flight.callsign?.trim() || 'UNKNOWN',
    icao24: flight.icao24,
    airline: getAirlineFromCallsign(flight.callsign),
    position: vrPosition,
    gps: {
      latitude: flight.latitude,
      longitude: flight.longitude,
      altitude: flight.baro_altitude,
    },
    velocity: flight.velocity || 0,
    heading: flight.true_track || 0,
    distance,
    elevation,
    azimuth,
    onGround: flight.on_ground,
    lastUpdate: Date.now(),
  };
}

/**
 * Extract airline from callsign
 */
function getAirlineFromCallsign(callsign: string): string {
  if (!callsign) return 'Unknown';
  
  // Common airline prefixes
  const airlinePrefixes: { [key: string]: string } = {
    'LH': 'Lufthansa',
    'BA': 'British Airways',
    'AF': 'Air France',
    'KL': 'KLM',
    'LX': 'Swiss',
    'OS': 'Austrian',
    'SN': 'Brussels Airlines',
    'EW': 'Eurowings',
    'FR': 'Ryanair',
    'U2': 'easyJet',
    'W6': 'Wizz Air',
    'TK': 'Turkish Airlines',
    'SU': 'Aeroflot',
    'LO': 'LOT Polish Airlines',
    'OK': 'Czech Airlines',
    'JP': 'Adria Airways',
    'OU': 'Croatia Airlines',
    'JU': 'Air Serbia',
    'RO': 'Tarom',
    'FB': 'Bulgaria Air',
  };

  const prefix = callsign.substring(0, 2);
  return airlinePrefixes[prefix] || 'Unknown';
}

/**
 * Format speed for display
 */
export function formatSpeed(velocity: number): string {
  const kmh = velocity * 3.6;
  return `${Math.round(kmh)} km/h`;
}

/**
 * Format altitude for display
 */
export function formatAltitude(altitude: number): string {
  return `${Math.round(altitude)} m`;
}

/**
 * Format distance for display
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${Math.round(distance * 10) / 10} km`;
}
