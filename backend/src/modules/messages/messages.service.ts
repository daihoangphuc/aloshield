import { Injectable, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../../shared/services/supabase.service';
import { ConversationsService } from '../conversations/conversations.service';

export interface SendMessageDto {
  conversationId: string;
  encryptedContent: string;
  contentType: 'text' | 'image' | 'video' | 'file' | 'audio';
  sessionVersion: number;
  ratchetStep: number;
  replyToMessageId?: string;
  attachments?: Array<{
    attachmentId: string;
    encryptedFileKey: string;
  }>;
}

@Injectable()
export class MessagesService {
  constructor(
    private supabaseService: SupabaseService,
    private conversationsService: ConversationsService,
  ) {}

  async sendMessage(userId: string, dto: SendMessageDto) {
    // Verify user is participant
    const isParticipant = await this.conversationsService.isParticipant(
      dto.conversationId,
      userId,
    );

    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    // Create message
    const message = await this.supabaseService.createMessage({
      conversation_id: dto.conversationId,
      sender_id: userId,
      encrypted_content: dto.encryptedContent,
      content_type: dto.contentType,
      session_version: dto.sessionVersion,
      ratchet_step: dto.ratchetStep,
      reply_to_message_id: dto.replyToMessageId,
      status: 'sent', // Mặc định là sent
    });

    // Handle attachments if any
    if (dto.attachments && dto.attachments.length > 0) {
      const supabase = this.supabaseService.getAdminClient();
      
      for (const attachment of dto.attachments) {
        await supabase
          .from('attachments')
          .update({ message_id: message.id })
          .eq('id', attachment.attachmentId);
      }
    }

    // Get full message with sender info
    return this.getMessageById(message.id);
  }

  async getMessageById(messageId: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
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
      .eq('id', messageId)
      .single();

    if (error) throw error;
    return data;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    limit = 50,
    before?: string,
  ) {
    // Verify user is participant
    const isParticipant = await this.conversationsService.isParticipant(
      conversationId,
      userId,
    );

    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    const messages = await this.supabaseService.getMessagesByConversation(
      conversationId,
      limit,
      before,
    );

    return {
      messages: messages.reverse(), // Oldest first
      hasMore: messages.length === limit,
    };
  }

  async markAsDelivered(messageId: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // 1. Cập nhật record trong table messages (nếu chưa read)
    const { data: currentMsg } = await supabase
      .from('messages')
      .select('status')
      .eq('id', messageId)
      .single();

    if (currentMsg && currentMsg.status !== 'read') {
      await supabase
        .from('messages')
        .update({ status: 'delivered' })
        .eq('id', messageId);
    }

    // 2. Upsert vào message_receipts
    const { error } = await supabase
      .from('message_receipts')
      .upsert({
        message_id: messageId,
        user_id: userId,
        delivered_at: new Date().toISOString(),
      }, {
        onConflict: 'message_id,user_id',
      });

    if (error) throw error;
    return { success: true };
  }

  async markAsRead(messageId: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // 1. Cập nhật record trong table messages
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('id', messageId);

    // 2. Upsert vào message_receipts
    const { error } = await supabase
      .from('message_receipts')
      .upsert({
        message_id: messageId,
        user_id: userId,
        delivered_at: new Date().toISOString(),
        read_at: new Date().toISOString(),
      }, {
        onConflict: 'message_id,user_id',
      });

    if (error) throw error;
    return { success: true };
  }

  async deleteMessage(messageId: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Verify user is sender
    const { data: message } = await supabase
      .from('messages')
      .select('sender_id, conversation_id')
      .eq('id', messageId)
      .single();

    if (!message || message.sender_id !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) throw error;
    return { success: true, conversationId: message.conversation_id };
  }

  async editMessage(messageId: string, userId: string, newContent: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Verify user is sender
    const { data: message } = await supabase
      .from('messages')
      .select('sender_id, conversation_id, created_at')
      .eq('id', messageId)
      .single();

    if (!message || message.sender_id !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    // Check if message is within edit time limit (15 minutes)
    const createdAt = new Date(message.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    
    if (diffMinutes > 15) {
      throw new ForbiddenException('Messages can only be edited within 15 minutes');
    }

    const { error } = await supabase
      .from('messages')
      .update({ 
        encrypted_content: newContent,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (error) throw error;
    
    return this.getMessageById(messageId);
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Verify message exists and user is participant
    const { data: message } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('id', messageId)
      .single();

    if (!message) {
      throw new ForbiddenException('Message not found');
    }

    const isParticipant = await this.conversationsService.isParticipant(
      message.conversation_id,
      userId,
    );

    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    // Upsert reaction
    const { error } = await supabase
      .from('message_reactions')
      .upsert({
        message_id: messageId,
        user_id: userId,
        emoji,
      }, {
        onConflict: 'message_id,user_id',
      });

    if (error) throw error;
    
    return this.getReactions(messageId);
  }

  async removeReaction(messageId: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);

    if (error) throw error;
    
    return this.getReactions(messageId);
  }

  async getReactions(messageId: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('message_reactions')
      .select(`
        emoji,
        user_id,
        users!user_id (
          id,
          username,
          display_name
        )
      `)
      .eq('message_id', messageId);

    if (error) throw error;
    
    // Group by emoji
    const grouped: Record<string, { emoji: string; users: any[]; count: number }> = {};
    for (const reaction of data || []) {
      if (!grouped[reaction.emoji]) {
        grouped[reaction.emoji] = { emoji: reaction.emoji, users: [], count: 0 };
      }
      grouped[reaction.emoji].users.push(reaction.users);
      grouped[reaction.emoji].count++;
    }
    
    return Object.values(grouped);
  }
}

