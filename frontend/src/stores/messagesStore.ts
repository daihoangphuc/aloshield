import { create } from "zustand";
import { Message } from "@/lib/api";

interface Reaction {
  emoji: string;
  users: { id: string; username: string; display_name: string }[];
  count: number;
}

interface MessagesState {
  messages: Record<string, Message[]>; // conversationId -> messages
  isLoading: boolean;
  hasMore: Record<string, boolean>;

  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  addMessages: (conversationId: string, messages: Message[], prepend?: boolean) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  updateMessageId: (tempId: string, realId: string) => void;
  updateMessageStatus: (messageId: string, status: "sent" | "delivered" | "read") => void;
  updateMessageContent: (messageId: string, content: string, editedAt: string) => void;
  updateMessageReactions: (messageId: string, reactions: Reaction[]) => void;
  markMessageDeleted: (messageId: string, conversationId: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  setLoading: (loading: boolean) => void;
  setHasMore: (conversationId: string, hasMore: boolean) => void;
  getMessages: (conversationId: string) => Message[];
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: {},
  isLoading: false,
  hasMore: {},

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
      isLoading: false,
    })),

  addMessage: (message) =>
    set((state) => {
      const conversationMessages = state.messages[message.conversation_id] || [];
      
      // Check if message already exists (by id or tempId)
      const exists = conversationMessages.some(
        (m) => m.id === message.id
      );

      if (exists) {
        return state;
      }

      return {
        messages: {
          ...state.messages,
          [message.conversation_id]: [...conversationMessages, message],
        },
      };
    }),

  addMessages: (conversationId, newMessages, prepend = false) =>
    set((state) => {
      const existingMessages = state.messages[conversationId] || [];
      const existingIds = new Set(existingMessages.map((m) => m.id));
      const uniqueNewMessages = newMessages.filter((m) => !existingIds.has(m.id));

      return {
        messages: {
          ...state.messages,
          [conversationId]: prepend
            ? [...uniqueNewMessages, ...existingMessages]
            : [...existingMessages, ...uniqueNewMessages],
        },
      };
    }),

  updateMessage: (messageId, updates) =>
    set((state) => {
      const newMessages = { ...state.messages };

      for (const conversationId in newMessages) {
        newMessages[conversationId] = newMessages[conversationId].map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        );
      }

      return { messages: newMessages };
    }),

  updateMessageId: (tempId, realId) =>
    set((state) => {
      const newMessages = { ...state.messages };

      for (const conversationId in newMessages) {
        newMessages[conversationId] = newMessages[conversationId].map((msg) =>
          msg.id === tempId ? { ...msg, id: realId } : msg
        );
      }

      return { messages: newMessages };
    }),

  updateMessageStatus: (messageId, status) =>
    set((state) => {
      const newMessages = { ...state.messages };

      for (const conversationId in newMessages) {
        newMessages[conversationId] = newMessages[conversationId].map((msg) =>
          msg.id === messageId ? { ...msg, status } : msg
        );
      }

      return { messages: newMessages };
    }),

  updateMessageContent: (messageId, content, editedAt) =>
    set((state) => {
      const newMessages = { ...state.messages };

      for (const conversationId in newMessages) {
        newMessages[conversationId] = newMessages[conversationId].map((msg) =>
          msg.id === messageId ? { ...msg, content, encrypted_content: content, edited_at: editedAt } : msg
        );
      }

      return { messages: newMessages };
    }),

  updateMessageReactions: (messageId, reactions) =>
    set((state) => {
      const newMessages = { ...state.messages };

      for (const conversationId in newMessages) {
        newMessages[conversationId] = newMessages[conversationId].map((msg) =>
          msg.id === messageId ? { ...msg, reactions } : msg
        );
      }

      return { messages: newMessages };
    }),

  markMessageDeleted: (messageId, conversationId) =>
    set((state) => {
      const newMessages = { ...state.messages };
      
      if (newMessages[conversationId]) {
        newMessages[conversationId] = newMessages[conversationId].map((msg) =>
          msg.id === messageId ? { ...msg, deleted_at: new Date().toISOString() } : msg
        );
      }

      return { messages: newMessages };
    }),

  deleteMessage: (conversationId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: state.messages[conversationId]?.filter(
          (m) => m.id !== messageId
        ) || [],
      },
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setHasMore: (conversationId, hasMore) =>
    set((state) => ({
      hasMore: {
        ...state.hasMore,
        [conversationId]: hasMore,
      },
    })),

  getMessages: (conversationId) => {
    return get().messages[conversationId] || [];
  },
}));

