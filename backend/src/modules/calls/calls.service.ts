import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SupabaseService } from '../../shared/services/supabase.service';

export interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
  validUntil: number;
}

@Injectable()
export class CallsService {
  constructor(
    private supabaseService: SupabaseService,
    private configService: ConfigService,
  ) {}

  async createCall(
    conversationId: string,
    callerId: string,
    callType: 'audio' | 'video',
  ) {
    const supabase = this.supabaseService.getAdminClient();

    const { data: call, error } = await supabase
      .from('calls')
      .insert([{
        conversation_id: conversationId,
        caller_id: callerId,
        type: callType,
        status: 'initiated',
        participants: JSON.stringify([callerId]),
      }])
      .select()
      .single();

    if (error) throw error;
    return call;
  }

  async updateCallStatus(
    callId: string,
    status: 'ringing' | 'answered' | 'rejected' | 'missed' | 'ended' | 'failed',
  ) {
    const supabase = this.supabaseService.getAdminClient();

    const updateData: any = { status };

    if (status === 'answered') {
      updateData.answered_at = new Date().toISOString();
    } else if (status === 'ended' || status === 'rejected' || status === 'missed' || status === 'failed') {
      updateData.ended_at = new Date().toISOString();
    }

    const { data: call, error } = await supabase
      .from('calls')
      .update(updateData)
      .eq('id', callId)
      .select()
      .single();

    if (error) throw error;

    // Calculate duration if call was answered
    if (status === 'ended' && call.answered_at) {
      const answeredAt = new Date(call.answered_at);
      const endedAt = new Date(call.ended_at);
      const duration = Math.floor((endedAt.getTime() - answeredAt.getTime()) / 1000);

      await supabase
        .from('calls')
        .update({ duration })
        .eq('id', callId);
    }

    return call;
  }

  async getCallById(callId: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('calls')
      .select(`
        *,
        caller:users!caller_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('id', callId)
      .single();

    if (error) throw error;
    return data;
  }

  async getCallHistory(conversationId: string, limit = 20) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('calls')
      .select(`
        *,
        caller:users!caller_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('conversation_id', conversationId)
      .order('initiated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Generate time-limited TURN credentials
  getTurnCredentials(userId: string): TurnCredentials {
    const turnSecret = this.configService.get<string>('TURN_SECRET') || 'default-turn-secret';
    const turnServer = this.configService.get<string>('TURN_SERVER_URL') || 'turn:turn.aloshield.com:3478';

    const timestamp = Math.floor(Date.now() / 1000) + 3600; // Valid for 1 hour
    const username = `${timestamp}:${userId}`;

    const credential = crypto
      .createHmac('sha1', turnSecret)
      .update(username)
      .digest('base64');

    return {
      urls: [
        `${turnServer}?transport=udp`,
        `${turnServer}?transport=tcp`,
        turnServer.replace('turn:', 'turns:').replace(':3478', ':5349') + '?transport=tcp',
      ],
      username,
      credential,
      validUntil: timestamp * 1000,
    };
  }

  // Free STUN servers (no TURN for now)
  getIceServers(userId: string) {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ];
  }
}


