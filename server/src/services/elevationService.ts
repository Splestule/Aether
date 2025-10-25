import axios from 'axios'
import { ElevationResponse } from '@vr-flight-tracker/shared'
import { CacheService } from './cacheService.js'

export class ElevationService {
  private readonly ELEVATION_API_URL = 'https://api.open-elevation.com/api/v1/lookup'
  private readonly REQUEST_TIMEOUT = 5000 // 5 seconds
  private readonly MAX_RETRIES = 2

  constructor(private cacheService?: CacheService) {}

  /**
   * Get elevation for a specific coordinate
   */
  async getElevation(latitude: number, longitude: number): Promise<number> {
    const cacheKey = `elevation_${latitude.toFixed(6)}_${longitude.toFixed(6)}`
    
    // Check cache first
    if (this.cacheService) {
      const cached = this.cacheService.get<number>(cacheKey)
      if (cached !== undefined) {
        console.log('Returning cached elevation data')
        return cached
      }
    }

    try {
      const elevation = await this.fetchElevation(latitude, longitude)
      
      // Cache for 1 hour (elevation doesn't change often)
      if (this.cacheService) {
        this.cacheService.set(cacheKey, elevation, 3600)
      }

      console.log(`Fetched elevation ${elevation}m for ${latitude}, ${longitude}`)
      return elevation

    } catch (error) {
      console.error('Error fetching elevation:', error)
      // Return 0 as fallback (sea level)
      return 0
    }
  }

  /**
   * Get elevation for multiple coordinates
   */
  async getElevations(coordinates: Array<{ latitude: number; longitude: number }>): Promise<number[]> {
    const results: number[] = []
    const uncachedCoordinates: Array<{ latitude: number; longitude: number; index: number }> = []

    // Check cache for each coordinate
    for (let i = 0; i < coordinates.length; i++) {
      const { latitude, longitude } = coordinates[i]
      const cacheKey = `elevation_${latitude.toFixed(6)}_${longitude.toFixed(6)}`
      
      if (this.cacheService) {
        const cached = this.cacheService.get<number>(cacheKey)
        if (cached !== undefined) {
          results[i] = cached
          continue
        }
      }
      
      uncachedCoordinates.push({ latitude, longitude, index: i })
    }

    // Fetch uncached coordinates
    if (uncachedCoordinates.length > 0) {
      try {
        const elevations = await this.fetchElevations(uncachedCoordinates.map(c => ({
          latitude: c.latitude,
          longitude: c.longitude
        })))

        // Store results and cache them
        for (let i = 0; i < uncachedCoordinates.length; i++) {
          const { index } = uncachedCoordinates[i]
          const elevation = elevations[i]
          results[index] = elevation

          // Cache the result
          if (this.cacheService) {
            const { latitude, longitude } = uncachedCoordinates[i]
            const cacheKey = `elevation_${latitude.toFixed(6)}_${longitude.toFixed(6)}`
            this.cacheService.set(cacheKey, elevation, 3600)
          }
        }
      } catch (error) {
        console.error('Error fetching elevations:', error)
        // Fill with 0 for failed requests
        for (const { index } of uncachedCoordinates) {
          results[index] = 0
        }
      }
    }

    return results
  }

  /**
   * Fetch elevation from Open-Elevation API
   */
  private async fetchElevation(latitude: number, longitude: number): Promise<number> {
    const requestData = {
      locations: [{ latitude, longitude }]
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`Fetching elevation from API (attempt ${attempt}/${this.MAX_RETRIES})`)
        
        const response = await axios.post<{ results: ElevationResponse[] }>(
          this.ELEVATION_API_URL,
          requestData,
          {
            timeout: this.REQUEST_TIMEOUT,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'VR-Flight-Tracker/1.0',
            },
          }
        )

        if (response.data && response.data.results && response.data.results.length > 0) {
          return response.data.results[0].elevation
        } else {
          throw new Error('Invalid response format from elevation API')
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        console.warn(`Elevation API attempt ${attempt} failed:`, lastError.message)
        
        if (attempt < this.MAX_RETRIES) {
          // Short delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    throw new Error(`Failed to fetch elevation after ${this.MAX_RETRIES} attempts: ${lastError?.message}`)
  }

  /**
   * Fetch elevations for multiple coordinates
   */
  private async fetchElevations(coordinates: Array<{ latitude: number; longitude: number }>): Promise<number[]> {
    const requestData = {
      locations: coordinates
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`Fetching ${coordinates.length} elevations from API (attempt ${attempt}/${this.MAX_RETRIES})`)
        
        const response = await axios.post<{ results: ElevationResponse[] }>(
          this.ELEVATION_API_URL,
          requestData,
          {
            timeout: this.REQUEST_TIMEOUT,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'VR-Flight-Tracker/1.0',
            },
          }
        )

        if (response.data && response.data.results) {
          return response.data.results.map(result => result.elevation)
        } else {
          throw new Error('Invalid response format from elevation API')
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        console.warn(`Elevation API attempt ${attempt} failed:`, lastError.message)
        
        if (attempt < this.MAX_RETRIES) {
          // Short delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    throw new Error(`Failed to fetch elevations after ${this.MAX_RETRIES} attempts: ${lastError?.message}`)
  }
}
