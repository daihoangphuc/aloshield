import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './services/supabase.service';
import { R2Service } from './services/r2.service';
import { RedisService } from './services/redis.service';
import { EmailService } from './services/email.service';

@Global()
@Module({
  providers: [SupabaseService, R2Service, RedisService, EmailService],
  exports: [SupabaseService, R2Service, RedisService, EmailService],
})
export class SharedModule {}





