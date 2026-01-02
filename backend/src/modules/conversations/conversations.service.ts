import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../shared/services/supabase.service';
import { RedisService } from '../../shared/services/redis.service';

@Injectable()
export class ConversationsService {
  constructor(
    private supabaseService: SupabaseService,
    private redisService: RedisService,
  ) {}

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

    // Invalidate cache for both users (non-blocking)
    this.redisService.invalidateConversations(userId).catch(err => 
      console.error('Cache invalidation error (non-fatal):', err)
    );
    this.redisService.invalidateConversations(participantId).catch(err => 
      console.error('Cache invalidation error (non-fatal):', err)
    );

    return this.getConversationById(conversation.id, userId);
  }

  async getConversationById(conversationId: string, userId: string) {
    // Check cache first
    const cacheKey = `conversation:${conversationId}:${userId}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      // Cache miss or error - continue to DB query
    }

    const supabase = this.supabaseService.getAdminClient();

    // Verify user is participant
    const isParticipant = await this.supabaseService.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    // Get conversation with participants
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

    // Get last message and unread count in parallel
    const myParticipant = conversation.conversation_participants.find(
      (p: any) => p.user_id === userId
    );

    const [lastMessageResult, unreadCountResult] = await Promise.all([
      supabase
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
        .limit(1)
        .maybeSingle(),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .gt('created_at', myParticipant?.last_read_at || '1970-01-01'),
    ]);

    const lastMessage = lastMessageResult.data || null;
    const unreadCount = unreadCountResult.count || 0;

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
      unread_count: unreadCount,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
    };

    // Cache for 5 minutes (non-blocking)
    this.redisService.set(cacheKey, result, 300).catch(err => 
      console.error('Cache set error (non-fatal):', err)
    );

    return result;
  }

  async getConversations(userId: string, limit = 50, offset = 0) {
    // Try to get from cache first (only for first page)
    if (offset === 0) {
      try {
        const cached = await this.redisService.getCachedConversations(userId);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return {
            conversations: cached.slice(0, limit),
            total: cached.length,
          };
        }
      } catch (error) {
        // If cache fails, continue to database query
        console.error('Cache get error (non-fatal):', error);
      }
    }

    const supabase = this.supabaseService.getAdminClient();

    // Optimized: Single query to get all conversations with participants
    // Try with deleted_at filter first, fallback if column doesn't exist
    let participationsQuery = supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        last_read_at,
        deleted_at,
        conversations!inner (
          id,
          type,
          name,
          avatar_url,
          created_at,
          updated_at,
          conversation_participants!inner (
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
        )
      `)
      .eq('user_id', userId)
      .order('conversations(updated_at)', { ascending: false });

    const { data: participations, error: participationsError } = await participationsQuery;

    if (participationsError) {
      // Fallback: try without deleted_at column
      const fallbackQuery = supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          last_read_at,
          conversations!inner (
            id,
            type,
            name,
            avatar_url,
            created_at,
            updated_at,
            conversation_participants!inner (
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
          )
        `)
        .eq('user_id', userId)
        .order('conversations(updated_at)', { ascending: false });

      const fallbackResult = await fallbackQuery;
      if (fallbackResult.error) throw fallbackResult.error;
      
      const filtered = fallbackResult.data?.filter((p: any) => !p.deleted_at) || [];
      return this.processConversationsList(filtered, userId, limit, offset);
    }

    if (!participations || participations.length === 0) {
      return { conversations: [], total: 0 };
    }

    // Filter out soft-deleted conversations
    const activeParticipations = participations.filter((p: any) => !p.deleted_at);
    
    return this.processConversationsList(activeParticipations, userId, limit, offset);
  }

  private async processConversationsList(
    participations: any[],
    userId: string,
    limit: number,
    offset: number,
  ) {
    const supabase = this.supabaseService.getAdminClient();
    const conversationIds = participations.map(p => p.conversations.id);

    // Batch load last messages for all conversations
    const { data: lastMessages } = await supabase
      .from('messages')
      .select(`
        conversation_id,
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
      .in('conversation_id', conversationIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Group last messages by conversation_id (get most recent per conversation)
    const lastMessagesMap = new Map<string, any>();
    if (lastMessages) {
      for (const msg of lastMessages) {
        if (!lastMessagesMap.has(msg.conversation_id)) {
          lastMessagesMap.set(msg.conversation_id, msg);
        }
      }
    }

    // Batch load unread counts for all conversations
    const unreadCounts = await Promise.all(
      participations.map(async (p) => {
        const conv = p.conversations;
        const myParticipant = conv.conversation_participants.find(
          (cp: any) => cp.user_id === userId
        );
        
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', userId)
          .gt('created_at', myParticipant?.last_read_at || p.last_read_at || '1970-01-01');
        
        return { conversationId: conv.id, count: count || 0 };
      })
    );

    const unreadCountsMap = new Map(
      unreadCounts.map(u => [u.conversationId, u.count])
    );

    // Transform data
    const conversations = participations.map((p) => {
      const conv = p.conversations;
      const lastMessage = lastMessagesMap.get(conv.id) || null;
      const unreadCount = unreadCountsMap.get(conv.id) || 0;

      const otherParticipant = conv.conversation_participants.find(
        (cp: any) => cp.user_id !== userId
      );
      const otherUser = otherParticipant?.users;

      return {
        id: conv.id,
        type: conv.type,
        name: conv.type === 'direct' 
          ? (otherUser?.display_name || otherUser?.username || 'Unknown')
          : conv.name,
        avatar_url: conv.type === 'direct' ? otherUser?.avatar_url : conv.avatar_url,
        participants: conv.conversation_participants.map((cp: any) => ({
          user_id: cp.user_id,
          last_read_at: cp.last_read_at,
          user: cp.users,
        })),
        last_message: lastMessage,
        unread_count: unreadCount,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
      };
    });

    // Already sorted by updated_at from query, but ensure it's correct
    conversations.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const safeOffset = Number(offset) || 0;
    const safeLimit = Number(limit) || 50;

    const finalResult = {
      conversations: conversations.slice(safeOffset, safeOffset + safeLimit),
      total: conversations.length,
    };

    // Cache the full list if offset is 0 (first page)
    if (offset === 0) {
      this.redisService.setCachedConversations(userId, conversations, 300).catch(err => 
        console.error('Cache set error (non-fatal):', err)
      );
    }

    return finalResult;
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

    // Invalidate cache (non-blocking)
    this.redisService.invalidateConversations(userId).catch(err => 
      console.error('Cache invalidation error (non-fatal):', err)
    );

    return { success: true, message: 'Conversation deleted' };
  }
}

