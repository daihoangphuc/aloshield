import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './services/supabase.service';
import { R2Service } from './services/r2.service';

@Global()
@Module({
  providers: [SupabaseService, R2Service],
  exports: [SupabaseService, R2Service],
})
export class SharedModule {}




