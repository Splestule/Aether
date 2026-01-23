import { ProcessedFlight, UserLocation } from '@vr-flight-tracker/shared';
import {
  gpsToVRCoordinates,
  calculateDistance,
  calculateBearing,
  calculateElevation,
} from '@vr-flight-tracker/shared';

export class DemoService {
  private demoFlights: ProcessedFlight[] = [];

  constructor() {
    this.generateDemoFlights();
  }

  /**
   * Generate demo flight data for testing
   */
  private generateDemoFlights() {
    const airlines = [
      'Lufthansa',
      'British Airways',
      'Air France',
      'KLM',
      'Swiss',
      'Austrian Airlines',
      'SAS',
      'Finnair',
      'Iberia',
      'TAP Air Portugal',
      'Brussels Airlines',
      'Eurowings',
      'Ryanair',
      'easyJet',
      'Wizz Air',
    ];

    const callsigns = [
      'LH123',
      'BA456',
      'AF789',
      'KL012',
      'LX345',
      'OS678',
      'SK901',
      'AY234',
      'IB567',
      'TP890',
      'SN123',
      'EW456',
      'FR789',
      'U2012',
      'W6345',
    ];

    // Generate flights around Prague
    const centerLat = 50.0755;
    const centerLon = 14.4378;

    for (let i = 0; i < 15; i++) {
      // Random position within 50km radius
      const angle = (i / 15) * 2 * Math.PI;
      const distance = 5 + Math.random() * 45; // 5-50km
      const lat = centerLat + (distance / 111) * Math.cos(angle);
      const lon =
        centerLon + (distance / (111 * Math.cos((centerLat * Math.PI) / 180))) * Math.sin(angle);
      const altitude = 3000 + Math.random() * 8000; // 3-11km altitude

      const userLocation: UserLocation = {
        latitude: centerLat,
        longitude: centerLon,
        altitude: 200, // Prague elevation
      };

      const position = gpsToVRCoordinates(userLocation, lat, lon, altitude);
      const distanceFromUser = calculateDistance(centerLat, centerLon, lat, lon);
      const bearing = calculateBearing(centerLat, centerLon, lat, lon);
      const elevation = calculateElevation(userLocation, lat, lon, altitude);

      this.demoFlights.push({
        id: `demo_${i}`,
        callsign: callsigns[i],
        icao24: `DEMO${i.toString().padStart(2, '0')}`,
        airline: airlines[i],
        position,
        gps: {
          latitude: lat,
          longitude: lon,
          altitude,
        },
        velocity: 200 + Math.random() * 300, // 200-500 m/s
        heading: Math.random() * 360,
        distance: distanceFromUser,
        elevation,
        azimuth: bearing,
        onGround: false,
        lastUpdate: Date.now(),
      });
    }
  }

  /**
   * Get demo flights in area
   */
  getFlightsInArea(latitude: number, longitude: number, radiusKm: number): ProcessedFlight[] {
    // Filter flights within radius
    return this.demoFlights.filter((flight) => {
      const distance = calculateDistance(
        latitude,
        longitude,
        flight.gps.latitude,
        flight.gps.longitude
      );
      return distance <= radiusKm;
    });
  }

  /**
   * Get a specific demo flight by ICAO
   */
  getFlightByIcao(icao: string): ProcessedFlight | null {
    return this.demoFlights.find((flight) => flight.icao24 === icao) || null;
  }

  /**
   * Update demo flights (simulate movement)
   */
  updateFlights() {
    this.demoFlights.forEach((flight) => {
      // Simulate movement
      const speed = flight.velocity / 3600; // km/h to km/s
      const headingRad = (flight.heading * Math.PI) / 180;

      // Move flight slightly
      const newLat = flight.gps.latitude + (speed * Math.sin(headingRad)) / 111;
      const newLon =
        flight.gps.longitude +
        (speed * Math.cos(headingRad)) / (111 * Math.cos((flight.gps.latitude * Math.PI) / 180));

      flight.gps.latitude = newLat;
      flight.gps.longitude = newLon;
      flight.lastUpdate = Date.now();

      // Update position (would need user location for proper calculation)
      // For demo purposes, we'll just update the timestamp
    });
  }

  /**
   * Get demo flight count
   */
  getFlightCount(): number {
    return this.demoFlights.length;
  }
}
