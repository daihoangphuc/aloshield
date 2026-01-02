import { Injectable, OnModuleInit, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isAvailable = false;
  private lastErrorLogTime = 0;
  private readonly ERROR_LOG_INTERVAL = 30000; // Log errors max once per 30 seconds

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    if (!redisHost) {
      this.logger.log('Redis not configured (REDIS_HOST not set) - caching will be disabled');
      return;
    }

    try {
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      
      const redisConfig: any = {
        host: redisHost,
        port: redisPort,
        connectTimeout: nodeEnv === 'production' ? 10000 : 5000, // Longer timeout for production
        retryStrategy: (times: number) => {
          // Exponential backoff with max delay of 5 seconds
          const delay = Math.min(times * 100, 5000);
          // Stop retrying after 10 attempts (about 25 seconds total)
          if (times > 10) {
            this.logger.warn('Redis retry limit reached - caching will remain disabled');
            return null; // Stop retrying
          }
          return delay;
        },
        maxRetriesPerRequest: null, // Disable automatic retries on failed requests
        enableReadyCheck: true,
        enableOfflineQueue: false, // Don't queue commands when offline
        lazyConnect: true, // Don't connect immediately
      };

      // Only set password if it's actually provided, not empty, and not just whitespace
      // Works for both dev (localhost, no password) and prod (redis service name, with password)
      if (redisPassword && typeof redisPassword === 'string' && redisPassword.trim().length > 0) {
        redisConfig.password = redisPassword.trim();
      }

      this.client = new Redis(redisConfig);

      this.client.on('connect', () => {
        this.logger.log(`Redis connecting to ${redisHost}:${redisPort}...`);
      });

      this.client.on('ready', () => {
        this.logger.log(`Redis connected successfully to ${redisHost}:${redisPort}`);
        this.isAvailable = true;
        this.lastErrorLogTime = 0; // Reset error log timer on successful connection
      });

      this.client.on('error', (error: any) => {
        const now = Date.now();
        // Only log errors if enough time has passed since last log
        if (now - this.lastErrorLogTime > this.ERROR_LOG_INTERVAL) {
          // Don't log AggregateError details, just a simple message
          if (error.name === 'AggregateError' || error.message?.includes('AggregateError')) {
            this.logger.warn(`Redis connection unavailable - caching disabled (will retry silently)`);
          } else {
            this.logger.warn(`Redis error: ${error.message || error.name || 'Connection failed'} - caching disabled`);
          }
          this.lastErrorLogTime = now;
        }
        this.isAvailable = false;
      });

      this.client.on('close', () => {
        // Only log close events occasionally to avoid spam
        const now = Date.now();
        if (now - this.lastErrorLogTime > this.ERROR_LOG_INTERVAL) {
          this.logger.debug('Redis connection closed');
          this.lastErrorLogTime = now;
        }
        this.isAvailable = false;
      });

      this.client.on('reconnecting', (delay: number) => {
        // Only log reconnecting occasionally
        const now = Date.now();
        if (now - this.lastErrorLogTime > this.ERROR_LOG_INTERVAL) {
          this.logger.debug(`Redis reconnecting in ${delay}ms...`);
          this.lastErrorLogTime = now;
        }
      });

      // Try to connect with timeout
      try {
        await Promise.race([
          this.client.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis connection timeout')), 10000)
          )
        ]);

        // Test connection with ping
        await Promise.race([
          this.client.ping(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis ping timeout')), 5000)
          )
        ]);

        this.isAvailable = true;
        this.logger.log(`Redis ready and connected to ${redisHost}:${redisPort}`);
      } catch (pingError: any) {
        // Initial connection failed - this is expected if Redis is not available
        this.logger.warn(`Redis not available at ${redisHost}:${redisPort} - caching will be disabled. App will continue without Redis.`);
        this.isAvailable = false;
        // Keep client for background retries, but mark as unavailable
      }
    } catch (error: any) {
      this.logger.warn(`Redis initialization failed - caching disabled. App will continue without Redis. Error: ${error.message || error}`);
      this.isAvailable = false;
      // Don't set client to null, let it retry in background silently
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Redis connection closed');
      } catch (error) {
        this.logger.warn('Error closing Redis connection:', error);
        // Force disconnect if quit fails
        this.client.disconnect();
      }
    }
  }

  // Check if Redis is available
  isRedisAvailable(): boolean {
    return this.isAvailable && this.client !== null;
  }

  // Get value from cache
  async get<T>(key: string): Promise<T | null> {
    if (!this.isRedisAvailable()) return null;

    try {
      const value = await this.client!.get(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value) as T;
      } catch (parseError) {
        // Only log parse errors occasionally
        const now = Date.now();
        if (now - this.lastErrorLogTime > this.ERROR_LOG_INTERVAL) {
          this.logger.warn(`Redis GET parse error for key ${key} - deleting corrupted entry`);
          this.lastErrorLogTime = now;
        }
        // Delete corrupted cache entry silently
        await this.client!.del(key).catch(() => {});
        return null;
      }
    } catch (error: any) {
      // If connection error, mark as unavailable silently
      if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED') || error.message?.includes('MaxRetriesPerRequest')) {
        this.isAvailable = false;
      }
      // Don't log individual operation errors to avoid spam
      return null;
    }
  }

  // Set value in cache with TTL
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isRedisAvailable()) return false;

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client!.setex(key, ttlSeconds, serialized);
      } else {
        await this.client!.set(key, serialized);
      }
      return true;
    } catch (error: any) {
      // If connection error, mark as unavailable silently
      if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED') || error.message?.includes('MaxRetriesPerRequest')) {
        this.isAvailable = false;
      }
      // Don't log individual operation errors to avoid spam
      return false;
    }
  }

  // Delete key from cache
  async delete(key: string): Promise<boolean> {
    if (!this.isRedisAvailable()) return false;

    try {
      await this.client!.del(key);
      return true;
    } catch (error: any) {
      // If connection error, mark as unavailable silently
      if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED') || error.message?.includes('MaxRetriesPerRequest')) {
        this.isAvailable = false;
      }
      // Don't log individual operation errors to avoid spam
      return false;
    }
  }

  // Delete multiple keys matching pattern
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isRedisAvailable()) return 0;

    try {
      const stream = this.client!.scanStream({
        match: pattern,
        count: 100,
      });

      let deletedCount = 0;
      for await (const keys of stream) {
        if (keys.length > 0) {
          const count = await this.client!.del(...keys);
          deletedCount += count;
        }
      }

      return deletedCount;
    } catch (error: any) {
      // If connection error, mark as unavailable silently
      if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED') || error.message?.includes('MaxRetriesPerRequest')) {
        this.isAvailable = false;
      }
      // Don't log individual operation errors to avoid spam
      return 0;
    }
  }

  // Cache helpers for common use cases

  // Cache conversations list for user (TTL: 5 minutes)
  async getCachedConversations(userId: string) {
    return this.get(`conversations:${userId}`);
  }

  async setCachedConversations(userId: string, conversations: any[], ttlSeconds = 300) {
    return this.set(`conversations:${userId}`, conversations, ttlSeconds);
  }

  async invalidateConversations(userId: string) {
    return this.delete(`conversations:${userId}`);
  }

  // Cache messages for conversation (TTL: 2 minutes)
  async getCachedMessages(conversationId: string, limit: number, before?: string) {
    const key = before 
      ? `messages:${conversationId}:${limit}:${before}`
      : `messages:${conversationId}:${limit}:latest`;
    return this.get(key);
  }

  async setCachedMessages(conversationId: string, messages: any[], limit: number, before?: string, ttlSeconds = 120) {
    const key = before 
      ? `messages:${conversationId}:${limit}:${before}`
      : `messages:${conversationId}:${limit}:latest`;
    return this.set(key, messages, ttlSeconds);
  }

  async invalidateMessages(conversationId: string) {
    return this.deletePattern(`messages:${conversationId}:*`);
  }

  // Cache user presence (TTL: 1 minute)
  async getCachedUserPresence(userId: string) {
    return this.get(`presence:${userId}`);
  }

  async setCachedUserPresence(userId: string, presence: { isOnline: boolean; lastSeenAt?: string }, ttlSeconds = 60) {
    return this.set(`presence:${userId}`, presence, ttlSeconds);
  }

  async invalidateUserPresence(userId: string) {
    return this.delete(`presence:${userId}`);
  }

  // Cache conversation metadata (TTL: 5 minutes)
  async getCachedConversation(conversationId: string, userId: string) {
    return this.get(`conversation:${conversationId}:${userId}`);
  }

  async setCachedConversation(conversationId: string, userId: string, data: any, ttlSeconds = 300) {
    return this.set(`conversation:${conversationId}:${userId}`, data, ttlSeconds);
  }

  async invalidateConversation(conversationId: string) {
    // Delete all conversation-related cache keys
    await Promise.all([
      this.deletePattern(`conversation:${conversationId}:*`),
      this.delete(`conversation:participants:${conversationId}`),
    ]);
  }

  // Cache participants list (TTL: 5 minutes)
  async getCachedParticipants(conversationId: string) {
    return this.get(`conversation:participants:${conversationId}`);
  }

  async setCachedParticipants(conversationId: string, participants: any[], ttlSeconds = 300) {
    return this.set(`conversation:participants:${conversationId}`, participants, ttlSeconds);
  }

  // Cache user contacts (TTL: 10 minutes)
  async getCachedContacts(userId: string) {
    return this.get(`contacts:${userId}`);
  }

  async setCachedContacts(userId: string, contacts: any[], ttlSeconds = 600) {
    return this.set(`contacts:${userId}`, contacts, ttlSeconds);
  }

  async invalidateContacts(userId: string) {
    return this.delete(`contacts:${userId}`);
  }
}

