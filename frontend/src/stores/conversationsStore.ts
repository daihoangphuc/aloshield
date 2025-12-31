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
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              last_message: message,
              updated_at: message.created_at,
              unread_count:
                state.activeConversationId === conversationId
                  ? 0
                  : conv.unread_count + 1,
            }
          : conv
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    })),

  updateUnreadCount: (conversationId, count) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unread_count: count } : conv
      ),
    })),

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

