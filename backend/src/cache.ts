/**
 * Redis Cache Service
 * 
 * Provides caching functionality for API responses, database queries,
 * and session storage to improve performance and reduce database load.
 */

import Redis, { RedisOptions } from 'ioredis';
import { logger } from './logger';

// Cache configuration
export const CACHE_CONFIG = {
  // Default TTL in seconds
  DEFAULT_TTL: 3600, // 1 hour
  
  // Per-type TTL overrides
  TTL: {
    bookMetadata: 86400,      // 24 hours - book data changes infrequently
    searchResults: 300,        // 5 minutes - searches are frequent but results may change
    userSession: 604800,       // 7 days - sessions
    userProfile: 3600,         // 1 hour - profile data
    bookList: 900,             // 15 minutes - library views
    analytics: 3600,           // 1 hour - analytics data
  },
  
  // Key prefixes for namespacing
  PREFIX: 'booky:cache:',
  
  // Redis connection options
  MAX_RETRIES: 3,
  RETRY_DELAY: 100,
};

// Cache key builders
export const CacheKeys = {
  book: (id: string) => `${CACHE_CONFIG.PREFIX}book:${id}`,
  bookSearch: (query: string) => `${CACHE_CONFIG.PREFIX}book:search:${query}`,
  user: (id: string) => `${CACHE_CONFIG.PREFIX}user:${id}`,
  userSession: (id: string) => `${CACHE_CONFIG.PREFIX}session:${id}`,
  userBooks: (userId: string) => `${CACHE_CONFIG.PREFIX}user:${userId}:books`,
  bookList: (userId: string, page: number) => `${CACHE_CONFIG.PREFIX}user:${userId}:books:page:${page}`,
  analytics: (userId: string, type: string) => `${CACHE_CONFIG.PREFIX}analytics:${userId}:${type}`,
};

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

/**
 * Redis Cache Service Class
 */
export class CacheService {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    // Initialize connection lazily
  }

  /**
   * Connect to Redis server
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST 
        ? `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
        : undefined;

      const options: RedisOptions = {
        maxRetriesPerRequest: CACHE_CONFIG.MAX_RETRIES,
        retryStrategy: (times: number) => {
          if (times > CACHE_CONFIG.MAX_RETRIES) {
            return null; // Stop retrying
          }
          return Math.min(times * CACHE_CONFIG.RETRY_DELAY, 2000);
        },
        enableOfflineQueue: true,
        lazyConnect: true,
      };

      // Add password if provided
      if (process.env.REDIS_PASSWORD) {
        options.password = process.env.REDIS_PASSWORD;
      }

      // Add database number if provided
      if (process.env.REDIS_DB) {
        options.db = parseInt(process.env.REDIS_DB, 10);
      }

      if (redisUrl) {
        // For ioredis v5, connection string should be passed differently
        // Split the URL to extract host and port
        try {
          const url = new URL(redisUrl);
          options.host = url.hostname;
          options.port = parseInt(url.port, 10);
        } catch {
          // Fallback: just use the URL as-is for v5
          (options as any).url = redisUrl;
        }
      }

      this.client = new Redis(options);

      // Set up event handlers
      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.client.on('error', (err: Error) => {
        logger.error('Redis client error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;
      
      logger.info('Cache service connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      this.client = null;
      throw error;
    }
  }

  /**
   * Check if cache is available
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      await this.connect();
      if (!this.client) {
        return null;
      }

      const value = await this.client.get(key);
      if (!value) {
        return null;
      }

      try {
        const parsed: CacheEntry<T> = JSON.parse(value);
        return parsed.data as T;
      } catch {
        // If parsing fails, treat as raw string
        return value as unknown as T;
      }
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      await this.connect();
      if (!this.client) {
        return false;
      }

      const ttl = ttlSeconds || CACHE_CONFIG.DEFAULT_TTL;
      
      const entry: CacheEntry<T> = {
        data: value,
        cachedAt: Date.now(),
        ttl,
      };

      await this.client.setex(key, ttl, JSON.stringify(entry));
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.connect();
      if (!this.client) {
        return false;
      }

      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      await this.connect();
      if (!this.client) {
        return 0;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.client.del(...keys);
      logger.info(`Cache: deleted ${deleted} keys matching pattern ${pattern}`);
      return deleted;
    } catch (error) {
      logger.error(`Cache deletePattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.connect();
      if (!this.client) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL of a key
   */
  async getTTL(key: string): Promise<number> {
    try {
      await this.connect();
      if (!this.client) {
        return -1;
      }

      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Cache getTTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Increment a value
   */
  async increment(key: string): Promise<number | null> {
    try {
      await this.connect();
      if (!this.client) {
        return null;
      }

      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get or set pattern - fetch from cache, or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    const value = await fetchFn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Invalidate cache for a specific book
   */
  async invalidateBook(bookId: string): Promise<void> {
    await this.delete(CacheKeys.book(bookId));
    await this.deletePattern(CacheKeys.bookSearch('*'));
    
    // Also invalidate user book lists that might contain this book
    // This is a simple approach - could be more sophisticated with tags
    logger.info(`Cache invalidated for book: ${bookId}`);
  }

  /**
   * Invalidate cache for a user's books
   */
  async invalidateUserBooks(userId: string): Promise<void> {
    await this.delete(CacheKeys.userBooks(userId));
    await this.deletePattern(`${CACHE_CONFIG.PREFIX}user:${userId}:books:page:*`);
    logger.info(`Cache invalidated for user books: ${userId}`);
  }

  /**
   * Invalidate all user-related cache
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.delete(CacheKeys.user(userId));
    await this.invalidateUserBooks(userId);
    logger.info(`Cache invalidated for user: ${userId}`);
  }

  /**
   * Invalidate analytics cache
   */
  async invalidateAnalytics(userId: string): Promise<void> {
    await this.deletePattern(CacheKeys.analytics(userId, '*'));
    logger.info(`Cache invalidated for user analytics: ${userId}`);
  }

  /**
   * Clear all cache (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      await this.connect();
      if (!this.client) {
        return;
      }

      const keys = await this.client.keys(`${CACHE_CONFIG.PREFIX}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.info(`Cache cleared: ${keys.length} keys deleted`);
      }
    } catch (error) {
      logger.error('Cache clearAll error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    isConnected: boolean;
    keyCount: number;
    memoryUsage?: string;
  }> {
    try {
      await this.connect();
      if (!this.client) {
        return { isConnected: false, keyCount: 0 };
      }

      const keys = await this.client.keys(`${CACHE_CONFIG.PREFIX}*`);
      
      let memoryUsage: string | undefined;
      try {
        const info = await this.client.info('memory');
        const match = info.match(/used_memory_human:(\S+)/);
        if (match) {
          memoryUsage = match[1];
        }
      } catch {
        // Ignore info errors
      }

      return {
        isConnected: this.isConnected,
        keyCount: keys.length,
        memoryUsage,
      };
    } catch (error) {
      logger.error('Cache getStats error:', error);
      return { isConnected: false, keyCount: 0 };
    }
  }

  /**
   * Close the Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

/**
 * Higher-order function for caching middleware
 * Wraps an async function with caching logic
 */
export function withCache<T, Args extends unknown[]>(
  cacheKeyFn: (...args: Args) => string,
  ttlSeconds?: number
) {
  return function <R>(
    fn: (...args: Args) => Promise<R>
  ): (...args: Args) => Promise<R> {
    return async (...args: Args): Promise<R> => {
      const key = cacheKeyFn(...args);
      const cached = await cacheService.get<R>(key);
      
      if (cached !== null) {
        return cached;
      }
      
      const result = await fn(...args);
      await cacheService.set(key, result, ttlSeconds);
      return result;
    };
  };
}

/**
 * Cache decorator-like function for route handlers
 * Returns cached response or executes handler and caches result
 */
export async function cacheResponse<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  return cacheService.getOrSet(key, fetchFn, ttlSeconds);
}

export default cacheService;
