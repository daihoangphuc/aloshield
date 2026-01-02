import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;
  private supabaseAdmin: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Supabase configuration is missing');
    }

    // Public client (respects RLS)
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Admin client (bypasses RLS)
    this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  getAdminClient(): SupabaseClient {
    return this.supabaseAdmin;
  }

  // User operations
  async createUser(userData: {
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
  }) {
    const { data, error } = await this.supabaseAdmin
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserByEmail(email: string) {
    const { data, error } = await this.supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getUserById(id: string) {
    const { data, error } = await this.supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getUserByGoogleId(googleId: string) {
    const { data, error } = await this.supabaseAdmin
      .from('users')
      .select('*')
      .eq('google_id', googleId)
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
    password_hash: string;
  }>) {
    const { data, error } = await this.supabaseAdmin
      .from('users')
      .update(userData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Conversation operations
  async createConversation(type: 'direct' | 'group' = 'direct', createdBy: string) {
    const { data, error } = await this.supabaseAdmin
      .from('conversations')
      .insert([{ type, created_by: createdBy }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addParticipant(conversationId: string, userId: string) {
    const { data, error } = await this.supabaseAdmin
      .from('conversation_participants')
      .insert([{ conversation_id: conversationId, user_id: userId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getConversationsByUserId(userId: string) {
    const { data, error } = await this.supabaseAdmin
      .from('conversation_participants')
      .select(`
        conversation_id,
        last_read_at,
        conversations (
          id,
          type,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .order('conversations(updated_at)', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getDirectConversation(userId1: string, userId2: string) {
    const { data, error } = await this.supabaseAdmin.rpc('get_direct_conversation', {
      user_id_1: userId1,
      user_id_2: userId2,
    });

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseAdmin
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  // Message operations
  async createMessage(messageData: {
    conversation_id: string;
    sender_id: string;
    encrypted_content: string;
    content_type: string;
    session_version: number;
    ratchet_step: number;
    reply_to_message_id?: string;
    status?: 'sent' | 'delivered' | 'read';
  }) {
    const { data, error } = await this.supabaseAdmin
      .from('messages')
      .insert([messageData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getMessagesByConversation(conversationId: string, limit = 50, before?: string) {
    let query = this.supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender:users!sender_id (
          id,
          username,
          display_name,
          avatar_url
        ),
        attachments (
          id,
          r2_key,
          file_name,
          file_size,
          mime_type,
          thumbnail_r2_key
        )
      `)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  // Search users
  async searchUsers(query: string, excludeUserId: string, limit = 20) {
    const { data, error } = await this.supabaseAdmin
      .from('users')
      .select('id, username, display_name, avatar_url, is_online, last_seen_at')
      .neq('id', excludeUserId)
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Contacts / Friends
  async getContacts(userId: string) {
    const { data, error } = await this.supabaseAdmin
      .from('contacts')
      .select(`
        contact:users!contact_id (
          id,
          username,
          display_name,
          avatar_url,
          is_online,
          last_seen_at
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    return data?.map(c => c.contact) || [];
  }
}

