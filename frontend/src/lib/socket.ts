"use client";

import { io, Socket } from "socket.io-client";
import { config } from "./config";
import Cookies from "js-cookie";
import { useConversationsStore } from "@/stores/conversationsStore";
import { useMessagesStore } from "@/stores/messagesStore";
import { useCallStore } from "@/stores/callStore";
import { useAuthStore } from "@/stores/authStore";
// E2EE temporarily disabled
// import { getE2EEManager } from "./crypto/e2ee";

class SocketManager {
  private socket: Socket | null = null;
  private callsSocket: Socket | null = null;

  connect() {
    const token = Cookies.get("accessToken");
    if (!token) return;

    // Extract base URL and path
    // If wsUrl is like "wss://api.phucndh.site/api", extract base URL and path
    let baseWsUrl = config.wsUrl;
    let socketPath = '/socket.io/';
    
    if (config.wsUrl.includes('/api')) {
      // Split URL to get base and path
      const urlObj = new URL(config.wsUrl);
      baseWsUrl = `${urlObj.protocol}//${urlObj.host}`;
      socketPath = '/api/socket.io/';
    }

    console.log('🔌 Connecting sockets:', { baseWsUrl, socketPath });

    // Main socket for messages (default namespace)
    this.socket = io(baseWsUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      path: socketPath,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    this.setupMainSocketListeners();

    // Calls socket - connect to /calls namespace
    // Socket.IO client: namespace goes in the URL, path goes in options
    // URL: wss://api.phucndh.site/calls, path: /api/socket.io/
    // Result: wss://api.phucndh.site/api/socket.io/calls
    const callsUrl = `${baseWsUrl}/calls`;
    console.log('📞 Connecting calls socket to:', callsUrl, 'with path:', socketPath);
    this.callsSocket = io(callsUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      path: socketPath,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    this.callsSocket.on("connect", () => {
      console.log("📞 Calls socket connected, id:", this.callsSocket?.id);
    });

    this.callsSocket.on("disconnect", () => {
      console.log("📞 Calls socket disconnected");
    });

    this.callsSocket.on("connect_error", (error) => {
      console.error("📞 Calls socket connection error:", error);
    });

    this.setupCallsSocketListeners();

    // E2EE initialization disabled for now
    // TODO: Re-enable with proper key exchange protocol
  }

  private setupMainSocketListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("🔌 Socket connected");
    });

    this.socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
    });

    this.socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    // Message events
    this.socket.on("message:new", async (data) => {
      try {
        console.log("📩 New message received:", data);
        const myUserId = useAuthStore.getState().user?.id;
        const senderId = data.sender_id || data.senderId;
        const conversationId = data.conversation_id || data.conversationId;
        
        if (!conversationId) {
          console.warn("⚠️ Received message without conversationId:", data);
          return;
        }

        // If this is my own message (from another device or echoed back)
        if (senderId === myUserId) {
          // Check if we already have it with tempId
          if (data.tempId) {
            const existingMessages = useMessagesStore.getState().messages[conversationId] || [];
            const tempMessage = existingMessages.find(m => m.id === data.tempId);
            if (tempMessage) {
              console.log("🔄 Updating temp message ID:", data.tempId, "->", data.id);
              useMessagesStore.getState().updateMessageId(data.tempId, data.id);
              // ✅ IMPORTANT: Own messages ALWAYS start with "sent" status, never "read"
              // Even if server returns different status, we enforce "sent" for new own messages
              const correctStatus = "sent";
              useMessagesStore.getState().updateMessageStatus(data.id, correctStatus);
              
              // Also update last_message status to ensure consistency
              const convStore = useConversationsStore.getState();
              const conv = convStore.conversations.find(c => c.id === conversationId);
              if (conv && conv.last_message?.id === data.id) {
                convStore.updateMessageStatus(data.id, correctStatus);
              }
              return;
            }
          }
          // Don't process own messages that weren't optimistically added
          console.log("⏭️ Skipping own message (already processed):", data.id);
          return;
        }
        
        // This is a message from someone else
        const content = data.encrypted_content || data.encryptedContent || data.content;
        
        // ✅ Get activeConversationId MULTIPLE TIMES to ensure we have the latest value
        // This prevents race conditions when user just switched conversations
        const activeConversationId1 = useConversationsStore.getState().activeConversationId;
        const isInConversation1 = conversationId === activeConversationId1;
        
        console.log(`📩 Received message in conversation ${conversationId}, activeConversationId: ${activeConversationId1}, isInConversation: ${isInConversation1}`);

        // New messages from others start with "sent" status
        // Ensure attachments are properly included
        const messageWithStatus = {
          ...data,
          content: content,
          status: data.status || "sent",
          attachments: data.attachments || [],
        };
        
        console.log("📎 Message attachments:", data.attachments);

        // Add message to store
        useMessagesStore.getState().addMessage(messageWithStatus);
        
        // Update conversation - this will increment unread count if not in conversation
        useConversationsStore.getState().updateLastMessage(conversationId, messageWithStatus);
        
        // ✅ Re-check activeConversationId AFTER updateLastMessage (in case it changed)
        const activeConversationId2 = useConversationsStore.getState().activeConversationId;
        const isInConversation2 = conversationId === activeConversationId2;
        
        // 🔥 AUTO MARK AS READ: Only if user is currently viewing this conversation
        // Triple-check to be absolutely sure user is still in conversation
        if (isInConversation2 && data.id) {
          console.log("📖 Auto marking message as read (user is in conversation):", data.id);
          // Small delay to ensure message is processed first AND re-check activeConversationId ONE MORE TIME
          setTimeout(() => {
            // Final check - get fresh activeConversationId
            const currentActiveConvId = useConversationsStore.getState().activeConversationId;
            if (currentActiveConvId === conversationId) {
              console.log("✅ Confirmed user still in conversation, marking as read");
              socketManager.markAsRead(data.id);
            } else {
              console.log(`⏭️ User left conversation (current: ${currentActiveConvId}, message conv: ${conversationId}), skipping mark as read`);
            }
          }, 200); // Increased delay to ensure state is stable
        } else {
          console.log(`📬 Message received but user not in conversation (active: ${activeConversationId2}, message: ${conversationId}) - keeping as unread`);
        }
      } catch (error) {
        console.error("Error processing new message:", error);
      }
    });

    this.socket.on("message:delivered", (data) => {
      console.log("📬 Message delivered event received:", data);
      const messageId = data.messageId || data.message_id;
      if (messageId) {
        useMessagesStore.getState().updateMessageStatus(messageId, "delivered");
        // Also update conversation's last_message status
        useConversationsStore.getState().updateMessageStatus(messageId, "delivered");
        console.log("✅ Message status updated to delivered:", messageId);
      }
    });

    this.socket.on("message:read", (data) => {
      console.log("📖 Message read event received:", data);
      const messageId = data.messageId || data.message_id;
      if (messageId) {
        // Update message status in messages store
        useMessagesStore.getState().updateMessageStatus(messageId, "read");
        // Also update conversation's last_message status
        useConversationsStore.getState().updateMessageStatus(messageId, "read");
        console.log("✅ Message status updated to read:", messageId);
      }
    });

    // Message deleted
    this.socket.on("message:deleted", (data) => {
      useMessagesStore.getState().markMessageDeleted(data.messageId, data.conversationId);
    });

    // Message edited
    this.socket.on("message:edited", (data) => {
      useMessagesStore.getState().updateMessageContent(data.messageId, data.content, data.editedAt);
    });

    // Message reaction
    this.socket.on("message:reaction", (data) => {
      useMessagesStore.getState().updateMessageReactions(data.messageId, data.reactions);
    });

    // Typing events
    this.socket.on("typing:start", (data) => {
      useConversationsStore.getState().setTyping(data.conversationId, data.userId, true);
    });

    this.socket.on("typing:stop", (data) => {
      useConversationsStore.getState().setTyping(data.conversationId, data.userId, false);
    });

    // Presence events
    this.socket.on("user:online", (data) => {
      useConversationsStore.getState().updateUserPresence(data.userId, true);
    });

    this.socket.on("user:offline", (data) => {
      useConversationsStore.getState().updateUserPresence(data.userId, false);
    });

    // Conversation events - when someone sends you a message in a new/existing conversation
    this.socket.on("conversation:updated", (conversation) => {
      console.log("📬 Conversation updated:", conversation);
      const store = useConversationsStore.getState();
      const existing = store.conversations.find(c => c.id === conversation.id);
      
      if (existing) {
        // Update existing conversation
        // Merge with existing to preserve any local state if needed
        const updatedConversations = store.conversations.map(c => {
          if (c.id === conversation.id) {
            // Keep the higher unread count to avoid race conditions with message:new
            const unreadCount = Math.max(
              Number(c.unread_count) || 0,
              Number(conversation.unread_count) || 0
            );
            return { ...conversation, unread_count: unreadCount };
          }
          return c;
        });
        
        // Sort conversations to bring updated one to top
        updatedConversations.sort((a, b) => 
          new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        );
        
        store.setConversations(updatedConversations);
      } else {
        // Add new conversation to the list
        store.addConversation(conversation);
      }
    });
  }

  private setupCallsSocketListeners() {
    if (!this.callsSocket) return;

    this.callsSocket.on("call:incoming", (data) => {
      console.log("📞 Incoming call received:", data);
      console.log("📞 Setting incoming call in store...");
      useCallStore.getState().setIncomingCall(data);
      console.log("📞 Incoming call set:", useCallStore.getState().incomingCall);
    });

    this.callsSocket.on("call:accepted", (data) => {
      console.log("Call accepted:", data);
    });

    this.callsSocket.on("call:rejected", (data) => {
      console.log("Call rejected:", data);
      useCallStore.getState().endCall();
    });

    this.callsSocket.on("call:ended", (data) => {
      console.log("Call ended:", data);
      useCallStore.getState().endCall();
    });

    this.callsSocket.on("call:offer", (data) => {
      console.log("Call offer received:", data);
      useCallStore.getState().handleOffer(data);
    });

    this.callsSocket.on("call:answer", (data) => {
      console.log("Call answer received:", data);
      useCallStore.getState().handleAnswer(data);
    });

    this.callsSocket.on("call:ice-candidate", (data) => {
      console.log("ICE candidate received:", data);
      useCallStore.getState().handleIceCandidate(data);
    });
  }

  // Message methods with E2EE
  async sendMessage(data: {
    conversationId: string;
    encryptedContent: string;
    contentType: string;
    sessionVersion: number;
    ratchetStep: number;
    tempId?: string;
    recipientId?: string;
    nonce?: string;
    ephemeralPublicKey?: string;
    attachments?: Array<{
      attachmentId: string;
      encryptedFileKey: string;
    }>;
  }) {
    return new Promise(async (resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not connected"));
        return;
      }

      try {
        // E2EE disabled - send plaintext directly
        const messageData = { ...data };

        this.socket.emit(
          "message:send",
          messageData,
          (response: { success: boolean; message?: unknown; error?: string }) => {
            if (response.success) {
              resolve(response.message);
            } else {
              reject(new Error(response.error));
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  markAsDelivered(messageId: string) {
    this.socket?.emit("message:delivered", { messageId });
  }

  markAsRead(messageId: string) {
    if (!this.socket || !messageId) return;
    
    // Don't mark temp messages
    if (messageId.startsWith("temp-")) {
      console.log("⏭️ Skipping markAsRead for temp message:", messageId);
      return;
    }
    
    console.log("📤 Emitting message:read for:", messageId);
    this.socket.emit("message:read", { messageId }, (response: { success: boolean; error?: string }) => {
      if (response.success) {
        console.log("✅ Successfully marked as read:", messageId);
        // Also update local state immediately for better UX
        useMessagesStore.getState().updateMessageStatus(messageId, "read");
      } else {
        console.error("❌ Failed to mark as read:", messageId, response.error);
      }
    });
  }
  
  // Mark multiple messages as read at once
  markMultipleAsRead(messageIds: string[]) {
    if (!this.socket || messageIds.length === 0) return;
    
    // Emit for each message - backend will handle and emit back to sender
    messageIds.forEach(messageId => {
      this.socket?.emit("message:read", { messageId });
    });
  }

  // Delete message
  deleteMessage(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not connected"));
        return;
      }
      this.socket.emit(
        "message:delete",
        { messageId },
        (response: { success: boolean; error?: string }) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  // Edit message
  editMessage(messageId: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not connected"));
        return;
      }
      this.socket.emit(
        "message:edit",
        { messageId, content },
        (response: { success: boolean; error?: string }) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  // Add reaction
  addReaction(messageId: string, emoji: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not connected"));
        return;
      }
      this.socket.emit(
        "message:react",
        { messageId, emoji },
        (response: { success: boolean; error?: string }) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  // Remove reaction
  removeReaction(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not connected"));
        return;
      }
      this.socket.emit(
        "message:unreact",
        { messageId },
        (response: { success: boolean; error?: string }) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  // Typing methods
  startTyping(conversationId: string) {
    this.socket?.emit("typing:start", { conversationId });
  }

  stopTyping(conversationId: string) {
    this.socket?.emit("typing:stop", { conversationId });
  }

  // Call methods
  initiateCall(conversationId: string, recipientId: string, callType: "audio" | "video") {
    return new Promise((resolve, reject) => {
      if (!this.callsSocket) {
        reject(new Error("Calls socket not connected"));
        return;
      }

      this.callsSocket.emit(
        "call:initiate",
        { conversationId, recipientId, callType },
        (response: { success: boolean; callId?: string; iceServers?: RTCIceServer[]; error?: string }) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  acceptCall(callId: string) {
    return new Promise((resolve, reject) => {
      this.callsSocket?.emit(
        "call:accept",
        { callId },
        (response: { success: boolean; iceServers?: RTCIceServer[]; error?: string }) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  rejectCall(callId: string, reason?: string) {
    this.callsSocket?.emit("call:reject", { callId, reason });
  }

  sendOffer(callId: string, recipientId: string, offer: RTCSessionDescriptionInit) {
    this.callsSocket?.emit("call:offer", { callId, recipientId, offer });
  }

  sendAnswer(callId: string, recipientId: string, answer: RTCSessionDescriptionInit) {
    this.callsSocket?.emit("call:answer", { callId, recipientId, answer });
  }

  sendIceCandidate(callId: string, recipientId: string, candidate: RTCIceCandidateInit) {
    this.callsSocket?.emit("call:ice-candidate", { callId, recipientId, candidate });
  }

  endCall(callId: string) {
    this.callsSocket?.emit("call:end", { callId });
  }

  disconnect() {
    this.socket?.disconnect();
    this.callsSocket?.disconnect();
    this.socket = null;
    this.callsSocket = null;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketManager = new SocketManager();
