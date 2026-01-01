"use client";

import { io, Socket } from "socket.io-client";
import { config } from "./config";
import Cookies from "js-cookie";
import { useConversationsStore } from "@/stores/conversationsStore";
import { useMessagesStore } from "@/stores/messagesStore";
import { useCallStore } from "@/stores/callStore";
// E2EE temporarily disabled
// import { getE2EEManager } from "./crypto/e2ee";

class SocketManager {
  private socket: Socket | null = null;
  private callsSocket: Socket | null = null;

  connect() {
    const token = Cookies.get("accessToken");
    if (!token) return;

    // Main socket for messages
    this.socket = io(config.wsUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    this.setupMainSocketListeners();

    // Calls socket
    this.callsSocket = io(`${config.wsUrl}/calls`, {
      auth: { token },
      transports: ["websocket", "polling"],
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
        const myUserId = localStorage.getItem("userId");
        const senderId = data.sender_id || data.senderId;
        const conversationId = data.conversation_id || data.conversationId;
        
        // If this is my own message (from another device or echoed back), 
        // check if we already have it with tempId
        if (senderId === myUserId && data.tempId) {
          // Already added via optimistic update, just update the ID
          const existingMessages = useMessagesStore.getState().messages[conversationId] || [];
          const tempMessage = existingMessages.find(m => m.id === data.tempId);
          if (tempMessage) {
            // Update temp message with real ID
            useMessagesStore.getState().updateMessageId(data.tempId, data.id);
            return;
          }
        }
        
        // Use encrypted_content directly as content (E2EE disabled for now)
        const content = data.encrypted_content || data.encryptedContent || data.content;

        // New messages start with "sent" status
        const messageWithStatus = {
          ...data,
          content: content,
          status: data.status || "sent",
        };

        useMessagesStore.getState().addMessage(messageWithStatus);
        useConversationsStore.getState().updateLastMessage(conversationId, messageWithStatus);
      } catch (error) {
        console.error("Error processing new message:", error);
      }
    });

    this.socket.on("message:delivered", (data) => {
      console.log("📬 Message delivered:", data.messageId);
      useMessagesStore.getState().updateMessageStatus(data.messageId, "delivered");
      // Also update conversation's last_message status
      useConversationsStore.getState().updateMessageStatus(data.messageId, "delivered");
    });

    this.socket.on("message:read", (data) => {
      console.log("📖 Message read:", data.messageId);
      useMessagesStore.getState().updateMessageStatus(data.messageId, "read");
      // Also update conversation's last_message status
      useConversationsStore.getState().updateMessageStatus(data.messageId, "read");
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
        store.setConversations(
          store.conversations.map(c => c.id === conversation.id ? conversation : c)
        );
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
    this.socket?.emit("message:read", { messageId });
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
