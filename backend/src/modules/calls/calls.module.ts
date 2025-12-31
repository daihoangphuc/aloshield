import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CallsGateway } from './calls.gateway';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    ConversationsModule,
    UsersModule,
  ],
  controllers: [CallsController],
  providers: [CallsGateway, CallsService],
  exports: [CallsService],
})
export class CallsModule {}


