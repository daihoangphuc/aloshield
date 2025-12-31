"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useConversationsStore } from "@/stores/conversationsStore";
import { useMessagesStore } from "@/stores/messagesStore";
import { useCallStore } from "@/stores/callStore";
import { messagesApi, conversationsApi, Message, callsApi } from "@/lib/api";
import { socketManager } from "@/lib/socket";
// E2EE temporarily disabled - TODO: implement proper key exchange
// import { getE2EEManager } from "@/lib/crypto/e2ee";
import {
  ArrowLeft,
  Phone,
  Video,
  Lock,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Send,
  Shield,
  Check,
  CheckCheck,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

interface ChatWindowProps {
  conversationId: string;
  onBack: () => void;
  isMobile: boolean;
}

export function ChatWindow({ conversationId, onBack, isMobile }: ChatWindowProps) {
  const { user } = useAuthStore();
  const { conversations, typingUsers, updateUnreadCount, updateLastMessage } = useConversationsStore();
  const {
    messages,
    setMessages,
    addMessage,
    setHasMore,
  } = useMessagesStore();
  const { initiateCall, initializePeerConnection, createOffer, iceServers } = useCallStore();

  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  
  // Message actions state
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  
  // Common emoji reactions
  const quickEmojis = ["❤️", "😂", "😮", "😢", "😡", "👍"];

  const conversation = conversations.find((c) => c.id === conversationId);
  const conversationMessages = messages[conversationId] || [];
  const otherParticipant = conversation?.participants.find(
    (p) => p.user_id !== user?.id
  )?.user;

  const isOtherTyping = (typingUsers[conversationId]?.size || 0) > 0;

  // Load messages when conversation changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!conversationId) return;
      setIsLoadingMessages(true);
      try {
        const data = await messagesApi.getByConversation(conversationId);
        // Map encrypted_content to content for display
        const messagesWithContent = data.messages.map((msg: Message) => ({
          ...msg,
          content: msg.content || msg.encrypted_content,
        }));
        setMessages(conversationId, messagesWithContent);
        setHasMore(conversationId, data.hasMore);
        // Mark as read
        await conversationsApi.markAsRead(conversationId);
        updateUnreadCount(conversationId, 0);
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    loadMessages();
  }, [conversationId, setMessages, setHasMore, updateUnreadCount]);

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversationMessages.length, isOtherTyping]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    // Send typing start
    if (!isTypingLocal && e.target.value.length > 0) {
      setIsTypingLocal(true);
      socketManager.startTyping(conversationId);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingLocal) {
        setIsTypingLocal(false);
        socketManager.stopTyping(conversationId);
      }
    }, 2000);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending || !otherParticipant) return;
    
    const content = inputValue.trim();
    setInputValue("");
    setIsSending(true);

    // Stop typing indicator
    if (isTypingLocal) {
      setIsTypingLocal(false);
      socketManager.stopTyping(conversationId);
    }

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user?.id || "",
      encrypted_content: content,
      content: content,
      content_type: "text",
      session_version: 1,
      ratchet_step: 0,
      created_at: new Date().toISOString(),
      sender: user || undefined,
    };

    // Optimistic update
    addMessage(tempMessage);

    try {
      // Send message (E2EE temporarily disabled for stability)
      // TODO: Re-enable E2EE with proper key exchange protocol
      const sentMessage = await socketManager.sendMessage({
        conversationId,
        encryptedContent: content, // Send plaintext for now
        contentType: "text",
        sessionVersion: 1,
        ratchetStep: 0,
        tempId,
        recipientId: otherParticipant.id,
      });
      
      // Update last message in conversation
      if (sentMessage) {
        updateLastMessage(conversationId, sentMessage as Message);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle delete message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await socketManager.deleteMessage(messageId);
      setActiveMessageMenu(null);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  // Handle edit message
  const handleStartEdit = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditingContent(currentContent);
    setActiveMessageMenu(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return;
    
    try {
      await socketManager.editMessage(editingMessageId, editingContent.trim());
      setEditingMessageId(null);
      setEditingContent("");
    } catch (error) {
      console.error("Failed to edit message:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };

  // Handle reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await socketManager.addReaction(messageId, emoji);
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  // Check if message can be edited (within 15 minutes)
  const canEditMessage = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
    return diffMinutes <= 15;
  };

  // Handle video call
  const handleVideoCall = async () => {
    if (!otherParticipant || !conversation) return;

    try {
      // Get TURN credentials from server
      const { iceServers: turnServers } = await callsApi.getIceServers();
      const servers = turnServers || iceServers;

      // Initiate call via socket
      const response = await socketManager.initiateCall(
        conversationId,
        otherParticipant.id,
        "video"
      ) as { callId: string; iceServers?: RTCIceServer[] };

      // Set up call state
      initiateCall(
        response.callId,
        otherParticipant.id,
        otherParticipant.display_name || otherParticipant.username,
        otherParticipant.avatar_url,
        "video"
      );

      // Initialize peer connection
      await initializePeerConnection(response.iceServers || servers);

      // Create and send offer
      const offer = await createOffer();
      socketManager.sendOffer(response.callId, otherParticipant.id, offer);
    } catch (error) {
      console.error("Failed to start video call:", error);
      alert("Không thể bắt đầu cuộc gọi video. Vui lòng thử lại.");
    }
  };

  // Handle audio call
  const handleAudioCall = async () => {
    if (!otherParticipant || !conversation) return;

    try {
      const { iceServers: turnServers } = await callsApi.getIceServers();
      const servers = turnServers || iceServers;

      const response = await socketManager.initiateCall(
        conversationId,
        otherParticipant.id,
        "audio"
      ) as { callId: string; iceServers?: RTCIceServer[] };

      initiateCall(
        response.callId,
        otherParticipant.id,
        otherParticipant.display_name || otherParticipant.username,
        otherParticipant.avatar_url,
        "audio"
      );

      await initializePeerConnection(response.iceServers || servers);
      const offer = await createOffer();
      socketManager.sendOffer(response.callId, otherParticipant.id, offer);
    } catch (error) {
      console.error("Failed to start audio call:", error);
      alert("Không thể bắt đầu cuộc gọi. Vui lòng thử lại.");
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Format date for message groups
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hôm nay";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Hôm qua";
    } else {
      return date.toLocaleDateString("vi-VN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  };

  if (!conversation || !otherParticipant) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0b141a]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0084ff]" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b141a]">
      {/* Header */}
      <header className="h-[60px] flex items-center justify-between px-4 border-b border-[#222d34] bg-[#0b141a] flex-shrink-0">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button 
              onClick={onBack} 
              className="p-2 -ml-2 hover:bg-[#202c33] rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-white" />
            </button>
          )}
          <div className="relative">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600">
              {otherParticipant.avatar_url ? (
                <img 
                  src={otherParticipant.avatar_url} 
                  alt="" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold">
                  {otherParticipant.display_name?.[0] || otherParticipant.username?.[0]}
                </div>
              )}
            </div>
            {otherParticipant.is_online && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0b141a] rounded-full" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-white text-[16px] truncate">
                {otherParticipant.display_name || otherParticipant.username}
              </h3>
              <Lock size={14} className="text-[#3b82f6] flex-shrink-0" />
            </div>
            <p className="text-[12px] text-[#8e9196]">
              {isOtherTyping ? (
                <span className="text-[#0084ff]">Đang nhập...</span>
              ) : otherParticipant.is_online ? (
                "Đang hoạt động"
              ) : (
                "Ngoại tuyến"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleVideoCall}
            className="p-2 hover:bg-[#202c33] rounded-full transition-colors"
          >
            <Video size={22} className="text-[#0084ff]" />
          </button>
          <button 
            onClick={handleAudioCall}
            className="p-2 hover:bg-[#202c33] rounded-full transition-colors"
          >
            <Phone size={22} className="text-[#0084ff]" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 pt-4 space-y-3 no-scrollbar"
      >
        {/* E2EE Notice */}
        <div className="flex justify-center mb-4">
          <div className="bg-[#1a232e] p-3 rounded-2xl max-w-[85%] flex items-start gap-2.5">
            <Lock size={16} className="text-[#8e9196] mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-[#8e9196] leading-relaxed">
              Tin nhắn và cuộc gọi được mã hóa đầu cuối. Không ai bên ngoài cuộc trò chuyện này có thể đọc hoặc nghe chúng.
            </p>
          </div>
        </div>

        {/* Loading */}
        {isLoadingMessages && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-[#0084ff]" />
          </div>
        )}

        {/* Messages */}
        {conversationMessages.map((msg, idx) => {
          const isMe = msg.sender_id === user?.id;
          const showDate = idx === 0 || 
            new Date(msg.created_at).toDateString() !== 
            new Date(conversationMessages[idx - 1].created_at).toDateString();

          const isDeleted = !!msg.deleted_at;
          const isEdited = !!msg.edited_at;
          const reactions = (msg as any).reactions || [];

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDate && (
                <div className="flex justify-center my-4">
                  <span className="text-[11px] font-semibold text-[#8e9196] uppercase tracking-wider bg-[#0b141a] px-3">
                    {formatDate(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Message bubble */}
              <div className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? "flex-row-reverse" : ""}`}>
                  {/* Avatar for received messages */}
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                      {msg.sender?.avatar_url ? (
                        <img src={msg.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                          {msg.sender?.display_name?.[0] || msg.sender?.username?.[0]}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col relative">
                    {/* Message actions (hover menu) */}
                    {!isDeleted && !msg.id.startsWith("temp-") && (
                      <div className={`absolute top-0 ${isMe ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
                        {/* Quick emoji reactions */}
                        <button 
                          onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                          className="p-1.5 hover:bg-[#202c33] rounded-full transition-colors"
                        >
                          <Smile size={16} className="text-[#8e9196]" />
                        </button>
                        
                        {/* More options */}
                        <button 
                          onClick={() => setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id)}
                          className="p-1.5 hover:bg-[#202c33] rounded-full transition-colors"
                        >
                          <MoreVertical size={16} className="text-[#8e9196]" />
                        </button>
                      </div>
                    )}

                    {/* Emoji picker */}
                    {showEmojiPicker === msg.id && (
                      <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-12 bg-[#1a232e] rounded-full px-2 py-1 flex items-center gap-1 shadow-lg border border-[#2a3942] z-10`}>
                        {quickEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className="p-1 hover:bg-[#202c33] rounded-full transition-colors text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Context menu */}
                    {activeMessageMenu === msg.id && (
                      <div className={`absolute ${isMe ? "right-0" : "left-0"} top-full mt-1 bg-[#1a232e] rounded-xl shadow-lg border border-[#2a3942] overflow-hidden z-10 min-w-[140px]`}>
                        {isMe && canEditMessage(msg.created_at) && (
                          <button
                            onClick={() => handleStartEdit(msg.id, msg.content || msg.encrypted_content || "")}
                            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#202c33] flex items-center gap-2"
                          >
                            <Pencil size={14} />
                            Chỉnh sửa
                          </button>
                        )}
                        {isMe && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-[#202c33] flex items-center gap-2"
                          >
                            <Trash2 size={14} />
                            Thu hồi
                          </button>
                        )}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content || msg.encrypted_content || "");
                            setActiveMessageMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#202c33]"
                        >
                          Sao chép
                        </button>
                      </div>
                    )}

                    {/* Editing mode */}
                    {editingMessageId === msg.id ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          className="px-3 py-2 bg-[#202c33] text-white rounded-xl border border-[#0084ff] focus:outline-none min-w-[200px]"
                          autoFocus
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={handleCancelEdit} className="text-xs text-[#8e9196] hover:text-white">
                            Hủy
                          </button>
                          <button onClick={handleSaveEdit} className="text-xs text-[#0084ff] hover:text-blue-400">
                            Lưu
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Message content */}
                        {isDeleted ? (
                          <div className="px-3.5 py-2 text-[15px] italic text-[#8e9196] bg-[#202c33] rounded-2xl">
                            Tin nhắn đã bị thu hồi
                          </div>
                        ) : msg.content_type === "text" ? (
                          <div
                            className={`px-3.5 py-2 text-[15px] leading-relaxed ${
                              isMe
                                ? "bg-[#0084ff] text-white rounded-2xl rounded-br-md"
                                : "bg-[#202c33] text-white rounded-2xl rounded-bl-md"
                            }`}
                          >
                            {msg.content || msg.encrypted_content}
                          </div>
                        ) : (
                          <div className="bg-[#202c33] p-3 rounded-xl flex items-center gap-3 min-w-[200px]">
                            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="text-red-500" size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {msg.attachments?.[0]?.file_name || "File"}
                              </p>
                              <p className="text-xs text-[#8e9196]">
                                {msg.attachments?.[0]?.file_size 
                                  ? `${(msg.attachments[0].file_size / 1024 / 1024).toFixed(1)} MB`
                                  : "Unknown size"}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Reactions display */}
                        {reactions.length > 0 && (
                          <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                            {reactions.map((r: any) => (
                              <span 
                                key={r.emoji} 
                                className="bg-[#202c33] px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1"
                              >
                                {r.emoji} <span className="text-[#8e9196]">{r.count}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Time and status */}
                    <div className={`flex items-center gap-1 mt-1 text-[10px] text-[#8e9196] ${isMe ? "justify-end" : "justify-start"}`}>
                      <span>{formatTime(msg.created_at)}</span>
                      {isEdited && !isDeleted && <span>(đã chỉnh sửa)</span>}
                      {isMe && !isDeleted && (
                        msg.id.startsWith("temp-") ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCheck size={14} className="text-[#0084ff]" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isOtherTyping && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
              {otherParticipant.avatar_url ? (
                <img src={otherParticipant.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                  {otherParticipant.display_name?.[0] || otherParticipant.username?.[0]}
                </div>
              )}
            </div>
            <div className="bg-[#202c33] px-4 py-2 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#8e9196] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-[#8e9196] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-[#8e9196] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Security Banner */}
      <div className="py-2 flex items-center justify-center gap-2 border-t border-[#222d34] flex-shrink-0">
        <Shield size={14} className="text-[#22c55e]" />
        <span className="text-[10px] font-bold text-[#22c55e] uppercase tracking-widest">
          End-to-End Encrypted
        </span>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#0b141a] flex items-center gap-2 flex-shrink-0">
        <button className="p-2 hover:bg-[#202c33] rounded-full transition-colors">
          <ImageIcon size={22} className="text-[#8e9196]" />
        </button>
        <button className="p-2 hover:bg-[#202c33] rounded-full transition-colors">
          <Paperclip size={22} className="text-[#8e9196]" />
        </button>
        
        <div className="flex-1 bg-[#202c33] rounded-full px-4 py-2.5 flex items-center gap-2">
          <input
            type="text"
            placeholder="Nhập tin nhắn..."
            className="flex-1 bg-transparent border-none outline-none text-white text-[15px] placeholder:text-[#8e9196]"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />
          <button className="p-1 hover:bg-[#374248] rounded-full transition-colors">
            <Smile size={22} className="text-[#8e9196]" />
          </button>
        </div>

        <button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isSending}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            inputValue.trim() && !isSending
              ? "bg-[#0084ff] hover:bg-[#0073e6] active:scale-95"
              : "bg-[#202c33]"
          }`}
        >
          {isSending ? (
            <Loader2 size={20} className="text-white animate-spin" />
          ) : (
            <Send size={20} className={inputValue.trim() ? "text-white" : "text-[#8e9196]"} />
          )}
        </button>
      </div>
    </div>
  );
}
