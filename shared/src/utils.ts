import { UserLocation, ProcessedFlight, FlightData } from './types';

/**
 * Convert GPS coordinates to VR space coordinates
 * Uses bearing and distance to calculate local tangent plane coordinates
 * @param userLocation User's GPS position
 * @param flightLat Flight's latitude
 * @param flightLon Flight's longitude
 * @param flightAlt Flight's altitude in meters
 * @returns VR space coordinates (x, y, z) in meters
 */
export function gpsToVRCoordinates(
  userLocation: UserLocation,
  flightLat: number,
  flightLon: number,
  flightAlt: number
): { x: number; y: number; z: number } {
  // Calculate horizontal distance (returns kilometers)
  const distanceKm = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    flightLat,
    flightLon
  );
  
  // Calculate bearing (azimuth) in degrees
  const bearing = calculateBearing(
    userLocation.latitude,
    userLocation.longitude,
    flightLat,
    flightLon
  );

  // Convert distance from kilometers to meters
  const distanceM = distanceKm * 1000;

  // Convert to VR space (meters) - local tangent plane coordinates
  // In Three.js: X = right/left, Z = forward/backward, Y = up/down
  // For GPS: East-West maps to X, North-South maps to Z
  // Bearing: 0° = North, 90° = East
  // Fix central symmetry: swap X and Z axes
  const bearingRad = (bearing * Math.PI) / 180;
  // Swap X and Z to fix central symmetry through origin
  // X should represent North-South: cos(bearing) gives North component
  // Z should represent East-West: sin(bearing) gives East component
  const x = distanceM * Math.cos(bearingRad);   // North-South (positive = North)
  const z = distanceM * Math.sin(bearingRad);    // East-West (positive = East)
  const y = flightAlt - (userLocation.altitude || 0);  // Height unchanged

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
  userLocation: UserLocation,
  maxDistance: number = 200 // Default 200km, can be overridden
): ProcessedFlight | null {
  // Skip flights without position data
  // Use geo_altitude if baro_altitude is not available
  const altitude = flight.baro_altitude || flight.geo_altitude;
  if (!flight.longitude || !flight.latitude || (!altitude && altitude !== 0)) {
    return null;
  }

  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    flight.latitude,
    flight.longitude
  );

  // Skip flights too far away (use configurable maxDistance)
  if (distance > maxDistance) {
    return null;
  }

  const vrPosition = gpsToVRCoordinates(
    userLocation,
    flight.latitude,
    flight.longitude,
    altitude
  );

  const elevation = calculateElevation(
    userLocation,
    flight.latitude,
    flight.longitude,
    altitude
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
      altitude: altitude,
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
 * Extrapolate a flight's position based on its velocity and heading.
 */
export function extrapolatePosition(
  flight: ProcessedFlight,
  userLocation: UserLocation,
  secondsAhead: number
): {
  gps: { latitude: number; longitude: number; altitude: number };
  position: { x: number; y: number; z: number };
  distance: number;
  elevation: number;
  azimuth: number;
} | null {
  if (
    !userLocation ||
    !flight ||
    flight.onGround ||
    !isFinite(flight.velocity) ||
    flight.velocity <= 0
  ) {
    return null;
  }

  const METERS_PER_DEGREE_LAT = 111320;
  const distanceTraveled = flight.velocity * secondsAhead;
  const headingRad = (flight.heading * Math.PI) / 180;

  const latChange =
    (distanceTraveled * Math.cos(headingRad)) / METERS_PER_DEGREE_LAT;
  const latRad = (flight.gps.latitude * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  const lonChange =
    (distanceTraveled * Math.sin(headingRad)) /
    (METERS_PER_DEGREE_LAT * (Math.abs(cosLat) < 1e-6 ? 1e-6 : cosLat));

  const newLat = flight.gps.latitude + latChange;
  const newLon = flight.gps.longitude + lonChange;
  const altitude = flight.gps.altitude;

  const position = gpsToVRCoordinates(
    userLocation,
    newLat,
    newLon,
    altitude
  );

  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    newLat,
    newLon
  );

  const elevation = calculateElevation(
    userLocation,
    newLat,
    newLon,
    altitude
  );

  const azimuth = calculateBearing(
    userLocation.latitude,
    userLocation.longitude,
    newLat,
    newLon
  );

  return {
    gps: {
      latitude: newLat,
      longitude: newLon,
      altitude,
    },
    position,
    distance,
    elevation,
    azimuth,
  };
}

export function isTrajectoryRefreshDue(
  flight: ProcessedFlight,
  intervalMs: number
): boolean {
  if (!flight.lastTrajectoryRefresh) {
    return true;
  }

  return Date.now() - flight.lastTrajectoryRefresh >= intervalMs;
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
