import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../shared/services/supabase.service';

export interface CreateUserDto {
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  google_id?: string;
  supabase_id?: string;
  password_hash?: string;
  identity_public_key?: string;
  signed_pre_key?: string;
  signed_pre_key_signature?: string;
}

@Injectable()
export class UsersService {
  constructor(private supabaseService: SupabaseService) {}

  async createUser(userData: CreateUserDto) {
    return this.supabaseService.createUser(userData);
  }

  async findById(id: string) {
    return this.supabaseService.getUserById(id);
  }

  async findByEmail(email: string) {
    return this.supabaseService.getUserByEmail(email);
  }

  async findByGoogleId(googleId: string) {
    return this.supabaseService.getUserByGoogleId(googleId);
  }

  async findByUsername(username: string) {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findBySupabaseId(supabaseId: string) {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_id', supabaseId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateUser(id: string, userData: Partial<{
    display_name: string;
    avatar_url: string;
    bio: string;
    is_online: boolean;
    last_seen_at: string;
    google_id: string;
    supabase_id: string;
  }>) {
    return this.supabaseService.updateUser(id, userData);
  }

  async searchUsers(query: string, excludeUserId: string, limit = 20) {
    return this.supabaseService.searchUsers(query, excludeUserId, limit);
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    return this.updateUser(userId, {
      is_online: isOnline,
      last_seen_at: new Date().toISOString(),
    });
  }

  async getContacts(userId: string) {
    return this.supabaseService.getContacts(userId);
  }
}

