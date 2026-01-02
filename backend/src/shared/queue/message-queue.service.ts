import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);

  constructor(
    @InjectQueue('messages') private messagesQueue: Queue,
  ) {}

  async addOfflineMessageDelivery(data: {
    messageId: string;
    userId: string;
    conversationId: string;
  }): Promise<void> {
    try {
      await this.messagesQueue.add('deliver-offline-message', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
      this.logger.debug(`Queued offline message delivery for user ${data.userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to queue offline message: ${error.message}`);
    }
  }

  async scheduleMessageCleanup(olderThan: Date, conversationId?: string): Promise<void> {
    try {
      await this.messagesQueue.add(
        'cleanup-old-messages',
        { olderThan, conversationId },
        {
          delay: 24 * 60 * 60 * 1000, // Run after 24 hours
          attempts: 1,
        },
      );
      this.logger.debug(`Scheduled message cleanup for ${olderThan}`);
    } catch (error: any) {
      this.logger.error(`Failed to schedule message cleanup: ${error.message}`);
    }
  }
}

