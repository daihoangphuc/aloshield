import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './services/supabase.service';
import { R2Service } from './services/r2.service';
import { RedisService } from './services/redis.service';

@Global()
@Module({
  providers: [SupabaseService, R2Service, RedisService],
  exports: [SupabaseService, R2Service, RedisService],
})
export class SharedModule {}





