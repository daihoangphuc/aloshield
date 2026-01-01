import { create } from "zustand";
import { Conversation, Message } from "@/lib/api";

interface ConversationsState {
  conversations: Conversation[];
  activeConversationId: string | null;
  typingUsers: Record<string, Set<string>>; // conversationId -> Set of userIds
  isLoading: boolean;

  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  setActiveConversation: (id: string | null) => void;
  updateLastMessage: (conversationId: string, message: Message) => void;
  updateUnreadCount: (conversationId: string, count: number) => void;
  updateMessageStatus: (messageId: string, status: "sent" | "delivered" | "read") => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  updateUserPresence: (userId: string, isOnline: boolean) => void;
  setLoading: (loading: boolean) => void;
  getActiveConversation: () => Conversation | null;
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  typingUsers: {},
  isLoading: true,

  setConversations: (conversations) => set({ conversations, isLoading: false }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations.filter((c) => c.id !== conversation.id)],
    })),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  updateLastMessage: (conversationId, message) =>
    set((state) => {
      // Get current user ID to check if this is my message
      const myUserId = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.user?.id 
        : null;
      
      const isSentByMe = message.sender_id === myUserId;
      const isInActiveConversation = state.activeConversationId === conversationId;
      
      // ✅ CRITICAL: For own NEW messages, ALWAYS start with "sent" status
      // Check if this is a new message (different ID from current last_message)
      const currentConv = state.conversations.find(c => c.id === conversationId);
      const isNewMessage = !currentConv?.last_message || currentConv.last_message.id !== message.id;
      
      // Determine status: for own new messages, always "sent". For others, use message.status
      let messageStatus = message.status || "sent";
      if (isSentByMe && isNewMessage) {
        // This is a NEW message from me - MUST start as "sent" regardless of what message.status says
        // This prevents delayed "message:read" events from previous messages from affecting new messages
        messageStatus = "sent";
      }
      
      return {
        conversations: state.conversations.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                last_message: {
                  ...message,
                  status: messageStatus,
                },
                updated_at: message.created_at,
                // Only increment unread count if:
                // 1. Message is NOT from me (received from someone else)
                // 2. AND I'm NOT currently viewing this conversation
                unread_count: (!isSentByMe && !isInActiveConversation)
                  ? (Number(conv.unread_count) || 0) + 1
                  : (isInActiveConversation ? 0 : Number(conv.unread_count) || 0),
              }
            : conv
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
      };
    }),

  updateUnreadCount: (conversationId, count) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unread_count: count } : conv
      ),
    })),

  updateMessageStatus: (messageId, status) =>
    set((state) => {
      console.log(`📝 Updating message status: ${messageId} -> ${status}`);
      return {
        conversations: state.conversations.map((conv) => {
          // ✅ Only update if last_message.id EXACTLY matches messageId
          // This prevents race conditions where delayed read events update wrong messages
          if (conv.last_message?.id === messageId) {
            console.log(`✅ Found conversation with last_message id: ${messageId}, updating status to ${status}`);
            return {
              ...conv,
              last_message: {
                ...conv.last_message,
                status,
              },
            };
          } else if (conv.last_message?.id) {
            console.log(`⏭️ Skipping status update - last_message.id (${conv.last_message.id}) !== messageId (${messageId})`);
          }
          return conv;
        }),
      };
    }),

  setTyping: (conversationId, userId, isTyping) =>
    set((state) => {
      const currentTyping = state.typingUsers[conversationId] || new Set();
      const newTyping = new Set(currentTyping);

      if (isTyping) {
        newTyping.add(userId);
      } else {
        newTyping.delete(userId);
      }

      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: newTyping,
        },
      };
    }),

  updateUserPresence: (userId, isOnline) =>
    set((state) => ({
      conversations: state.conversations.map((conv) => ({
        ...conv,
        participants: conv.participants.map((p) =>
          p.user_id === userId
            ? { ...p, user: { ...p.user, is_online: isOnline } }
            : p
        ),
      })),
    })),

  setLoading: (isLoading) => set({ isLoading }),

  getActiveConversation: () => {
    const state = get();
    return state.conversations.find((c) => c.id === state.activeConversationId) || null;
  },
}));


