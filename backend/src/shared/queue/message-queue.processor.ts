import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('messages')
export class MessageQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageQueueProcessor.name);

  async process(job: Job): Promise<any> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'deliver-offline-message':
        return this.deliverOfflineMessage(job.data);
      case 'cleanup-old-messages':
        return this.cleanupOldMessages(job.data);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async deliverOfflineMessage(data: {
    messageId: string;
    userId: string;
    conversationId: string;
  }): Promise<void> {
    try {
      // This would be called when a user comes online
      // For now, just log - can be extended to send notification
      this.logger.log(`Delivering offline message ${data.messageId} to user ${data.userId}`);
      // TODO: Implement offline message delivery logic
    } catch (error: any) {
      this.logger.error(`Failed to deliver offline message: ${error.message}`);
      throw error;
    }
  }

  private async cleanupOldMessages(data: {
    conversationId?: string;
    olderThan: Date;
  }): Promise<void> {
    try {
      this.logger.log(`Cleaning up messages older than ${data.olderThan}`);
      // TODO: Implement message cleanup logic (archive or delete old messages)
      // This would typically archive messages older than X days
    } catch (error: any) {
      this.logger.error(`Failed to cleanup messages: ${error.message}`);
      throw error;
    }
  }
}

