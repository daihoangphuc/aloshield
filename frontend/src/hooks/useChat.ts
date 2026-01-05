import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useConversationsStore } from "@/stores/conversationsStore";
import { useMessagesStore } from "@/stores/messagesStore";
import { messagesApi, conversationsApi, attachmentsApi, Message } from "@/lib/api";
import { socketManager } from "@/lib/socket";

export function useChat(conversationId: string) {
  const { user } = useAuthStore();
  const { updateUnreadCount, updateLastMessage, typingUsers } = useConversationsStore();
  const { messages, setMessages, addMessage, setHasMore, deleteMessage, updateMessageStatus } = useMessagesStore();

  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  // Helper to get current messages for this conversation
  const conversationMessages = messages[conversationId] || [];

  // 1. Load Messages & Mark as Read
  useEffect(() => {
    let mounted = true;

    const loadMessages = async () => {
      if (!conversationId) return;
      setIsLoadingMessages(true);
      try {
        const data = await messagesApi.getByConversation(conversationId);
        const messagesWithContent = data.messages.map((msg: Message) => ({
          ...msg,
          content: msg.content || msg.encrypted_content,
        }));

        if (mounted) {
          setMessages(conversationId, messagesWithContent);
          setHasMore(conversationId, data.hasMore);
        }

        // Mark conversation as read
        await conversationsApi.markAsRead(conversationId);
        updateUnreadCount(conversationId, 0);

        // Mark individual messages as read via socket
        const unreadMessages = messagesWithContent.filter(
          (msg: Message) => msg.sender_id !== user?.id && msg.status !== "read"
        );

        if (unreadMessages.length > 0) {
          unreadMessages.forEach((msg: Message) => {
            socketManager.markAsRead(msg.id);
          });
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        if (mounted) setIsLoadingMessages(false);
      }
    };

    loadMessages();

    return () => {
      mounted = false;
    };
  }, [conversationId, user?.id, setMessages, setHasMore, updateUnreadCount]);

  // 2. Realtime Read Marking (When new messages arrive while viewing)
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    // We only mark as read if this is the *active* conversation in the UI
    // (This hook implies we are viewing it, but good to check store if needed,
    // though the component mounting usually implies viewing)

    const unreadMsgs = conversationMessages.filter(
      msg => msg.sender_id !== user.id && msg.status !== "read" && !msg.id.startsWith("temp-")
    );

    if (unreadMsgs.length > 0) {
      unreadMsgs.forEach(msg => {
         socketManager.markAsRead(msg.id);
      });
    }
  }, [conversationMessages, conversationId, user?.id]);


  // 3. Typing Logic
  const handleTyping = useCallback((isTyping: boolean) => {
    if (isTyping) {
      socketManager.startTyping(conversationId);
    } else {
      socketManager.stopTyping(conversationId);
    }
  }, [conversationId]);


  // 4. Send Text Message
  const sendMessage = useCallback(async (content: string, replyToMessageId?: string) => {
    if (!content.trim() || !user) return;

    setIsSending(true);
    socketManager.stopTyping(conversationId);

    const tempId = `temp-${Date.now()}`;
    // Optimistic Update
    const tempMessage: Message & { _renderKey?: string } = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      encrypted_content: content,
      content: content,
      content_type: "text",
      session_version: 1,
      ratchet_step: 0,
      created_at: new Date().toISOString(),
      sender: user,
      status: "sent",
      _renderKey: tempId,
      reply_to_message_id: replyToMessageId
    };

    addMessage(tempMessage);

    try {
      // Find recipient (a bit hacky, better to pass it in or store it, but we can infer from conversation)
      // For now, we rely on the backend to handle recipient finding or we need to pass it.
      // The original code used `otherParticipant.id`.
      // We should probably accept recipientId as an argument to make this hook pure,
      // or fetch it from the conversation store.
      const conversation = useConversationsStore.getState().conversations.find(c => c.id === conversationId);
      const recipient = conversation?.participants.find(p => p.user_id !== user.id);

      if (!recipient) throw new Error("Recipient not found");

      const sentMessage = await socketManager.sendMessage({
        conversationId,
        encryptedContent: content,
        contentType: "text",
        sessionVersion: 1,
        ratchetStep: 0,
        tempId,
        recipientId: recipient.user_id,
        replyToMessageId,
      });

      if (sentMessage) {
        updateLastMessage(conversationId, { ...sentMessage, status: "sent" } as Message);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      deleteMessage(conversationId, tempId);
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [conversationId, user, addMessage, updateLastMessage, deleteMessage]);


  // 5. Send Files
  const sendFiles = useCallback(async (files: File[]) => {
    if (files.length === 0 || !user) return;
    setIsUploading(true);

    try {
      const conversation = useConversationsStore.getState().conversations.find(c => c.id === conversationId);
      const recipient = conversation?.participants.find(p => p.user_id !== user.id);
      if (!recipient) throw new Error("Recipient not found");

      // Upload all files first
      const uploadPromises = files.map(async (file) => {
        const uploadResult = await attachmentsApi.upload(conversationId, file) as {
          attachmentId: string;
          r2Key: string;
          fileName: string;
          fileSize: number;
          mimeType: string;
        };
        return { file, uploadResult };
      });

      const uploadResults = await Promise.all(uploadPromises);

      // Send messages for each file
      const sendPromises = uploadResults.map(async ({ file, uploadResult }, index) => {
        const tempId = `temp-${Date.now()}-${index}`;
        let fileContentType: "image" | "video" | "audio" | "file" = "file";
        if (file.type.startsWith("image/")) fileContentType = "image";
        else if (file.type.startsWith("video/")) fileContentType = "video";
        else if (file.type.startsWith("audio/")) fileContentType = "audio";

        const tempMessage: Message & { _renderKey?: string } = {
          id: tempId,
          conversation_id: conversationId,
          sender_id: user.id,
          encrypted_content: `[${fileContentType}] ${file.name}`,
          content: `[${fileContentType}] ${file.name}`,
          content_type: fileContentType,
          session_version: 1,
          ratchet_step: 0,
          created_at: new Date().toISOString(),
          sender: user,
          status: "sent",
          _renderKey: tempId,
          attachments: [{
            id: uploadResult.attachmentId,
            r2_key: uploadResult.r2Key,
            file_name: uploadResult.fileName,
            file_size: uploadResult.fileSize,
            mime_type: uploadResult.mimeType,
          }],
        };

        addMessage(tempMessage);

        const sentMessage = await socketManager.sendMessage({
          conversationId,
          encryptedContent: `[${fileContentType}] ${file.name}`,
          contentType: fileContentType,
          sessionVersion: 1,
          ratchetStep: 0,
          tempId,
          recipientId: recipient.user_id,
          attachments: [{
            attachmentId: uploadResult.attachmentId,
            encryptedFileKey: "", // Implement encryption later if needed
          }],
        });

        if (sentMessage) {
          updateLastMessage(conversationId, { ...sentMessage, status: "sent" } as Message);
        }
      });

      await Promise.all(sendPromises);

    } catch (error) {
      console.error("Failed to send files:", error);
      throw error; // Let component handle UI feedback
    } finally {
      setIsUploading(false);
    }
  }, [conversationId, user, addMessage, updateLastMessage]);

  // 6. Message Actions
  const deleteMsg = useCallback(async (messageId: string) => {
     await socketManager.deleteMessage(messageId);
  }, []);

  const editMsg = useCallback(async (messageId: string, content: string) => {
     await socketManager.editMessage(messageId, content);
  }, []);

  const reactMsg = useCallback(async (messageId: string, emoji: string) => {
     await socketManager.addReaction(messageId, emoji);
  }, []);

  return {
    messages: conversationMessages,
    isLoading: isLoadingMessages,
    isSending,
    isUploading,
    sendMessage,
    sendFiles,
    handleTyping,
    deleteMsg,
    editMsg,
    reactMsg,
    user // Export user if needed for checking "isMe"
  };
}
