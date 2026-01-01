import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../shared/services/supabase.service';

@Injectable()
export class ConversationsService {
  constructor(private supabaseService: SupabaseService) {}

  async createDirectConversation(userId: string, participantId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        conversations!inner (
          id,
          type
        )
      `)
      .eq('user_id', userId)
      .eq('conversations.type', 'direct');

    if (existing && existing.length > 0) {
      // Check if participant is in any of these conversations
      for (const conv of existing) {
        const { data: participant } = await supabase
          .from('conversation_participants')
          .select('id')
          .eq('conversation_id', conv.conversation_id)
          .eq('user_id', participantId)
          .single();

        if (participant) {
          // Conversation already exists
          return this.getConversationById(conv.conversation_id, userId);
        }
      }
    }

    // Create new conversation
    const conversation = await this.supabaseService.createConversation('direct', userId);

    // Add both participants
    await this.supabaseService.addParticipant(conversation.id, userId);
    await this.supabaseService.addParticipant(conversation.id, participantId);

    return this.getConversationById(conversation.id, userId);
  }

  async getConversationById(conversationId: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Verify user is participant
    const isParticipant = await this.supabaseService.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .select(`
        id,
        type,
        name,
        avatar_url,
        created_at,
        updated_at,
        conversation_participants (
          user_id,
          last_read_at,
          users (
            id,
            username,
            display_name,
            avatar_url,
            is_online,
            last_seen_at
          )
        )
      `)
      .eq('id', conversationId)
      .single();

    if (error) throw error;
    if (!conversation) throw new NotFoundException('Conversation not found');

    // Get last message
    const { data: lastMessages } = await supabase
      .from('messages')
      .select(`
        id,
        encrypted_content,
        content_type,
        sender_id,
        status,
        created_at,
        sender:users!sender_id (
          id,
          username,
          display_name
        )
      `)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    
    const lastMessage = lastMessages?.[0] || null;

    // Get unread count
    const myParticipant = conversation.conversation_participants.find(
      (p: any) => p.user_id === userId
    );

    const { count: unreadCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .gt('created_at', myParticipant?.last_read_at || '1970-01-01');

    // Get other participant for direct chats
    const otherParticipant = conversation.conversation_participants.find(
      (p: any) => p.user_id !== userId
    );
    const otherUser = otherParticipant?.users as any;

    const result = {
      id: conversation.id,
      type: conversation.type,
      name: conversation.type === 'direct' 
        ? (otherUser?.display_name || otherUser?.username || 'Unknown')
        : conversation.name,
      avatar_url: conversation.type === 'direct'
        ? otherUser?.avatar_url
        : conversation.avatar_url,
      participants: conversation.conversation_participants.map((p: any) => ({
        user_id: p.user_id,
        last_read_at: p.last_read_at,
        user: p.users,
      })),
      last_message: lastMessage,
      unread_count: unreadCount || 0,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
    };

    return result;
  }

  async getConversations(userId: string, limit = 50, offset = 0) {
    const supabase = this.supabaseService.getAdminClient();

    // Get all conversation IDs for user
    // Try with deleted_at filter first, fallback to without if column doesn't exist
    let participations: any[] | null = null;
    let error: any = null;

    // First try with deleted_at filter (for soft delete support)
    const result = await supabase
      .from('conversation_participants')
      .select('conversation_id, deleted_at')
      .eq('user_id', userId);

    if (result.error) {
      // If error (column might not exist), try without the filter
      console.error('Error fetching with deleted_at:', result.error.message);
      const fallbackResult = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);
      
      participations = fallbackResult.data;
      error = fallbackResult.error;
    } else {
      // Filter out soft-deleted conversations
      participations = result.data?.filter((p: any) => !p.deleted_at) || [];
      error = null;
    }

    if (error) throw error;
    if (!participations || participations.length === 0) {
      return { conversations: [], total: 0 };
    }

    const conversationIds = participations.map(p => p.conversation_id);

    // Get conversations with details
    const conversations = await Promise.all(
      conversationIds.map(id => 
        this.getConversationById(id, userId).catch((err) => {
          console.error(`❌ Error loading conversation ${id}:`, err.message);
          return null;
        })
      )
    );

    // Filter null values and sort by updated_at
    const validConversations = conversations
      .filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    // Ensure offset and limit are numbers
    const safeOffset = Number(offset) || 0;
    const safeLimit = Number(limit) || 50;

    return {
      conversations: validConversations.slice(safeOffset, safeOffset + safeLimit),
      total: validConversations.length,
    };
  }

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    return this.supabaseService.isParticipant(conversationId, userId);
  }

  async markAsRead(conversationId: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { error } = await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  }

  async softDeleteConversation(conversationId: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Verify user is participant
    const isParticipant = await this.supabaseService.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    // Try soft delete first (if deleted_at column exists)
    const { error } = await supabase
      .from('conversation_participants')
      .update({ deleted_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) {
      // If soft delete fails (column doesn't exist), do hard delete
      console.warn('Soft delete failed, falling back to hard delete:', error.message);
      const { error: deleteError } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;
    }

    return { success: true, message: 'Conversation deleted' };
  }
}

