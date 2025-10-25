import axios from 'axios'
import { FlightData, ProcessedFlight, UserLocation, OpenSkyResponse } from '@vr-flight-tracker/shared'
import { processFlightData } from '@vr-flight-tracker/shared'
import { CacheService } from './cacheService.js'
import { DemoService } from './demoService.js'

export class FlightService {
  private readonly OPENSKY_API_URL = 'https://opensky-network.org/api/states/all'
  private readonly REQUEST_TIMEOUT = 10000 // 10 seconds
  private readonly MAX_RETRIES = 3
  private demoService: DemoService
  private useDemoData = false

  constructor(private cacheService: CacheService) {
    this.demoService = new DemoService()
  }

  /**
   * Get flights in a specific area
   */
  async getFlightsInArea(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<ProcessedFlight[]> {
    const cacheKey = `flights_${latitude.toFixed(4)}_${longitude.toFixed(4)}_${radiusKm}`
    
    // Check cache first
    const cached = this.cacheService.get<ProcessedFlight[]>(cacheKey)
    if (cached) {
      console.log('Returning cached flights data')
      return cached
    }

    // Try real data first, fallback to demo if needed
    console.log('Attempting to fetch real flight data from OpenSky API...')

    try {
      // Calculate bounding box
      const bbox = this.calculateBoundingBox(latitude, longitude, radiusKm)
      
      // Fetch from OpenSky API
      const rawFlights = await this.fetchFromOpenSky(bbox)
      
      // Process flights
      const userLocation: UserLocation = {
        latitude,
        longitude,
        altitude: 0, // Will be updated by elevation service
      }

      const processedFlights = rawFlights
      .map(flight => {
        console.log('Processing raw flight:', {
          icao24: flight.icao24,
          callsign: flight.callsign,
          latitude: flight.latitude,
          longitude: flight.longitude,
          altitude: flight.geo_altitude
        });
        
        const processed = processFlightData(flight, userLocation)
        if (!processed) {
          console.log(`Flight ${flight.icao24} was filtered out during processing because:`, {
            hasValidCoordinates: flight.latitude != null && flight.longitude != null,
            hasValidAltitude: flight.geo_altitude != null,
            hasValidSpeed: flight.velocity != null,
            hasValidHeading: flight.true_track != null
          });
        }
        return processed;
      })
      .filter((flight): flight is ProcessedFlight => {
        const valid = flight !== null;
        if (!valid) {
          console.log('Flight filtered out by null check');
        }
        return valid;
      })
      .filter(flight => {
        const inRange = flight.distance <= radiusKm;
        console.log(`Flight ${flight.icao24} distance check:`, {
          distance: flight.distance,
          radiusKm,
          inRange
        });
        return inRange;
      });

      // Cache the results for 15 seconds
      this.cacheService.set(cacheKey, processedFlights, 15)

      console.log(`Fetched ${processedFlights.length} flights for area ${latitude}, ${longitude}`)
      return processedFlights

    } catch (error) {
      console.error('Error fetching real flights, falling back to demo data:', error)
      // Fallback to demo data
      const demoFlights = this.demoService.getFlightsInArea(latitude, longitude, radiusKm)
      this.cacheService.set(cacheKey, demoFlights, 15)
      console.log(`Using ${demoFlights.length} demo flights as fallback`)
      return demoFlights
    }
  }

  /**
   * Get a specific flight by ICAO code
   */
  async getFlightByIcao(icao: string): Promise<ProcessedFlight | null> {
    const cacheKey = `flight_${icao}`
    
    // Check cache first
    const cached = this.cacheService.get<ProcessedFlight>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      // For now, we'll search in a large area around Europe
      // In a real implementation, you might want to use a different approach
      const bbox = this.calculateBoundingBox(50, 10, 1000) // Large area around Europe
      const rawFlights = await this.fetchFromOpenSky(bbox)
      
      const flight = rawFlights.find(f => f.icao24 === icao)
      if (!flight) {
        return null
      }

      // Process the flight (we'll use a default location for now)
      const userLocation: UserLocation = {
        latitude: 50,
        longitude: 10,
        altitude: 0,
      }

      const processedFlight = processFlightData(flight, userLocation)
      
      if (processedFlight) {
        // Cache for 30 seconds
        this.cacheService.set(cacheKey, processedFlight, 30)
      }

      return processedFlight

    } catch (error) {
      console.error('Error fetching flight by ICAO:', error)
      return null
    }
  }

  /**
   * Fetch raw flight data from OpenSky API
   */
  private async fetchFromOpenSky(bbox: {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  }): Promise<FlightData[]> {
    const params = {
      lamin: bbox.minLat,
      lomin: bbox.minLon,
      lamax: bbox.maxLat,
      lomax: bbox.maxLon,
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`Fetching from OpenSky API (attempt ${attempt}/${this.MAX_RETRIES})`)
        
        const response = await axios.get<OpenSkyResponse>(this.OPENSKY_API_URL, {
          params,
          timeout: this.REQUEST_TIMEOUT,
          headers: {
            'User-Agent': 'VR-Flight-Tracker/1.0',
          },
        });

        if (!response.data?.states) {
          console.warn('No flight data received from OpenSky API');
          return [];
        }

        const flights: FlightData[] = response.data.states.map((state): FlightData => ({
          icao24: String(state[0] || ''),
          callsign: String(state[1] || '').trim(),
          origin_country: String(state[2] || ''),
          time_position: Number(state[3] || 0),
          last_contact: Number(state[4] || 0),
          longitude: Number(state[5] || 0),
          latitude: Number(state[6] || 0),
          geo_altitude: Number(state[7] || 0),
          on_ground: Boolean(state[8]),
          velocity: Number(state[9] || 0),
          true_track: Number(state[10] || 0),
          vertical_rate: Number(state[11] || 0),
          sensors: Array.isArray(state[12]) ? state[12] : [],
          baro_altitude: Number(state[13] || 0),
          squawk: String(state[14] || ''),
          spi: Boolean(state[15]),
          position_source: Number(state[16] || 0),
        }));
  
        return flights;

      } catch (error) {
        lastError = error as Error;
        console.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt === this.MAX_RETRIES) {
          throw new Error(`Failed to fetch flight data after ${this.MAX_RETRIES} attempts: ${lastError.message}`);
        }
        // Add delay between retries
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    return []; // Fallback return if loop completes without success
}
  /**
   * Calculate bounding box for a given center point and radius
   */
  private calculateBoundingBox(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  } {
    // Approximate conversion: 1 degree ≈ 111 km
    const latDelta = radiusKm / 111
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180))

    return {
      minLat: latitude - latDelta,
      maxLat: latitude + latDelta,
      minLon: longitude - lonDelta,
      maxLon: longitude + lonDelta,
    }
  }

  /**
   * Get flight statistics
   */
  getStats(): {
    cacheHits: number
    cacheMisses: number
    totalRequests: number
  } {
    const stats = this.cacheService.getStats()
    return {
      cacheHits: stats.hits,
      cacheMisses: stats.misses,
      totalRequests: stats.hits + stats.misses,
    }
  }
}
