import { Injectable, OnModuleInit, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isAvailable = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);

    if (!redisHost) {
      this.logger.warn('Redis not configured - caching will be disabled');
      return;
    }

    try {
      this.client = new Redis({
        host: redisHost,
        port: redisPort,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.client.on('connect', () => {
        this.logger.log('Redis connected successfully');
        this.isAvailable = true;
      });

      this.client.on('error', (error) => {
        this.logger.error('Redis connection error:', error);
        this.isAvailable = false;
      });

      this.client.on('close', () => {
        this.logger.warn('Redis connection closed');
        this.isAvailable = false;
      });

      this.client.on('reconnecting', () => {
        this.logger.log('Redis reconnecting...');
      });

      // Test connection with timeout
      try {
        await Promise.race([
          this.client.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping timeout')), 5000))
        ]);
        this.isAvailable = true;
        this.logger.log(`Redis connected to ${redisHost}:${redisPort}`);
      } catch (pingError) {
        this.logger.warn('Redis ping failed - caching will be disabled', pingError);
        this.isAvailable = false;
        // Don't set client to null here, let it retry in background
      }
    } catch (error) {
      this.logger.warn('Redis connection failed - caching disabled', error);
      this.isAvailable = false;
      this.client = null;
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
        this.logger.error(`Redis GET parse error for key ${key}:`, parseError);
        // Delete corrupted cache entry
        await this.client!.del(key).catch(() => {});
        return null;
      }
    } catch (error: any) {
      // If connection error, mark as unavailable
      if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
        this.isAvailable = false;
      }
      this.logger.error(`Redis GET error for key ${key}:`, error.message || error);
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
      // If connection error, mark as unavailable
      if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
        this.isAvailable = false;
      }
      this.logger.error(`Redis SET error for key ${key}:`, error.message || error);
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
      // If connection error, mark as unavailable
      if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
        this.isAvailable = false;
      }
      this.logger.error(`Redis DELETE error for key ${key}:`, error.message || error);
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
      // If connection error, mark as unavailable
      if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
        this.isAvailable = false;
      }
      this.logger.error(`Redis DELETE PATTERN error for ${pattern}:`, error.message || error);
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
}

