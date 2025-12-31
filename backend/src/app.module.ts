import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { CallsModule } from './modules/calls/calls.module';
import { KeysModule } from './modules/keys/keys.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Shared services
    SharedModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    AttachmentsModule,
    CallsModule,
    KeysModule,
  ],
})
export class AppModule {}


