import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MessageQueueProcessor } from './message-queue.processor';
import { MessageQueueService } from './message-queue.service';

const logger = new Logger('QueueModule');

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');

        if (!redisHost) {
          logger.debug('Redis not configured - BullMQ will be disabled');
          // Return a config that will fail gracefully without spamming
          return {
            connection: {
              host: 'localhost',
              port: 6379,
              maxRetriesPerRequest: 0, // Don't retry
              retryStrategy: () => null, // Stop immediately
              connectTimeout: 1000, // Quick timeout
            },
          };
        }

        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        
        const connectionConfig: any = {
          host: redisHost,
          port: redisPort,
          connectTimeout: nodeEnv === 'production' ? 10000 : 5000, // Longer timeout for production
          maxRetriesPerRequest: null,
          retryStrategy: (times: number) => {
            // Stop retrying after 5 attempts
            if (times > 5) {
              return null;
            }
            return Math.min(times * 200, 2000);
          },
        };

        // Only add password if it's actually set, not empty, and not just whitespace
        // Works for both dev (localhost, no password) and prod (redis service name, with password)
        if (redisPassword && typeof redisPassword === 'string' && redisPassword.trim().length > 0) {
          connectionConfig.password = redisPassword.trim();
        }

        return {
          connection: connectionConfig,
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'messages',
    }),
  ],
  providers: [MessageQueueProcessor, MessageQueueService],
  exports: [MessageQueueService],
})
export class QueueModule {}

