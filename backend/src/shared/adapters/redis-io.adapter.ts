import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    private app: any,
    private configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    if (!redisHost) {
      this.logger.debug('Redis not configured - Socket.io will run without Redis adapter (single instance only)');
      return;
    }

    try {
      // Only include password if it's actually set, not empty, and not just whitespace
      // Works for both dev (localhost, no password) and prod (redis service name, with password)
      const hasPassword = redisPassword && typeof redisPassword === 'string' && redisPassword.trim().length > 0;

      // Longer timeout for production (Docker networking may be slower)
      const connectTimeout = nodeEnv === 'production' ? 10000 : 5000;

      // Use object config instead of URL to avoid password warnings when not needed
      const clientConfig: any = {
        socket: {
          host: redisHost,
          port: redisPort,
          connectTimeout,
          reconnectStrategy: (retries: number) => {
            if (retries > 5) {
              return false; // Stop reconnecting after 5 attempts
            }
            return Math.min(retries * 200, 2000);
          },
        },
      };

      // Only add password if actually needed (prevents warning when Redis doesn't require password)
      // This works for both dev (no password) and prod (with password)
      if (hasPassword) {
        clientConfig.password = redisPassword.trim();
      }

      const pubClient = createClient(clientConfig);

      const subClient = pubClient.duplicate();

      // Set timeout for connection (longer for production)
      const connectPromise = Promise.all([
        Promise.race([
          pubClient.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), connectTimeout)
          ),
        ]),
        Promise.race([
          subClient.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), connectTimeout)
          ),
        ]),
      ]);

      await connectPromise;

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log(`✅ Redis adapter connected for Socket.io (${redisHost}:${redisPort})`);
    } catch (error: any) {
      // Log error details for debugging (only once)
      if (error.message && !error.message.includes('timeout')) {
        this.logger.warn(`Redis adapter connection failed: ${error.message}`);
      }
      this.logger.debug(`Socket.io will run without Redis adapter (single instance only)`);
      this.adapterConstructor = null;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log('✅ Redis adapter applied to Socket.io server');
    }

    return server;
  }
}

