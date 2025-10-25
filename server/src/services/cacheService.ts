import NodeCache from 'node-cache'

export class CacheService {
  private cache: NodeCache
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  }

  constructor() {
    // Default TTL: 300 seconds (5 minutes)
    // Check period: 60 seconds
    this.cache = new NodeCache({
      stdTTL: 300,
      checkperiod: 60,
      useClones: false,
    })

    // Track cache events
    this.cache.on('hit', () => {
      this.stats.hits++
    })

    this.cache.on('miss', () => {
      this.stats.misses++
    })

    this.cache.on('set', () => {
      this.stats.sets++
    })

    this.cache.on('del', () => {
      this.stats.deletes++
    })
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key)
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    if (ttl) {
      return this.cache.set(key, value, ttl)
    }
    return this.cache.set(key, value)
  }

  /**
   * Delete value from cache
   */
  del(key: string): number {
    return this.cache.del(key)
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * Get multiple values from cache
   */
  mget<T>(keys: string[]): { [key: string]: T } {
    return this.cache.mget(keys) as { [key: string]: T }
  }

  /**
   * Set multiple values in cache
   */
  mset<T>(keyValuePairs: Array<{ key: string; val: T; ttl?: number }>): boolean {
    const pairs = keyValuePairs.map(({ key, val, ttl }) => ({
      key,
      val,
      ttl: ttl || this.cache.options.stdTTL,
    }))
    return this.cache.mset(pairs)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.flushAll()
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    keys: number
    hits: number
    misses: number
    sets: number
    deletes: number
    hitRate: number
    memory: {
      used: number
      total: number
    }
  } {
    const keys = this.cache.keys().length
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0

    return {
      keys,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      hitRate: Math.round(hitRate * 100) / 100,
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
      },
    }
  }

  /**
   * Get cache keys matching a pattern
   */
  keys(pattern?: string): string[] {
    const allKeys = this.cache.keys()
    if (!pattern) {
      return allKeys
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return allKeys.filter(key => regex.test(key))
  }

  /**
   * Get TTL for a key
   */
  getTtl(key: string): number | undefined {
    return this.cache.getTtl(key)
  }

  /**
   * Close the cache (cleanup)
   */
  close(): void {
    this.cache.close()
  }
}
