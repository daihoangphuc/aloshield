"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useConversationsStore } from "@/stores/conversationsStore";
import { useMessagesStore } from "@/stores/messagesStore";
import { useCallStore } from "@/stores/callStore";
import { messagesApi, conversationsApi, Message, callsApi } from "@/lib/api";
import { socketManager } from "@/lib/socket";
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
        const messagesWithContent = data.messages.map((msg: Message) => ({
          ...msg,
          content: msg.content || msg.encrypted_content,
        }));
        setMessages(conversationId, messagesWithContent);
        setHasMore(conversationId, data.hasMore);
        await conversationsApi.markAsRead(conversationId);
        updateUnreadCount(conversationId, 0);
        
        // Mark unread messages from others as read via socket
        const unreadMessages = messagesWithContent.filter(
          (msg: Message) => msg.sender_id !== user?.id && msg.status !== "read"
        );
        unreadMessages.forEach((msg: Message) => {
          socketManager.markAsRead(msg.id);
        });
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    loadMessages();
  }, [conversationId, setMessages, setHasMore, updateUnreadCount, user?.id]);

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversationMessages.length, isOtherTyping]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    if (!isTypingLocal && e.target.value.length > 0) {
      setIsTypingLocal(true);
      socketManager.startTyping(conversationId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

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

    addMessage(tempMessage);

    try {
      const sentMessage = await socketManager.sendMessage({
        conversationId,
        encryptedContent: content,
        contentType: "text",
        sessionVersion: 1,
        ratchetStep: 0,
        tempId,
        recipientId: otherParticipant.id,
      });
      
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

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await socketManager.deleteMessage(messageId);
      setActiveMessageMenu(null);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

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

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await socketManager.addReaction(messageId, emoji);
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  const canEditMessage = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
    return diffMinutes <= 15;
  };

  const handleVideoCall = async () => {
    if (!otherParticipant || !conversation) return;

    try {
      const { iceServers: turnServers } = await callsApi.getIceServers();
      const servers = turnServers || iceServers;

      const response = await socketManager.initiateCall(
        conversationId,
        otherParticipant.id,
        "video"
      ) as { callId: string; iceServers?: RTCIceServer[] };

      initiateCall(
        response.callId,
        otherParticipant.id,
        otherParticipant.display_name || otherParticipant.username,
        otherParticipant.avatar_url,
        "video"
      );

      await initializePeerConnection(response.iceServers || servers);
      const offer = await createOffer();
      socketManager.sendOffer(response.callId, otherParticipant.id, offer);
    } catch (error) {
      console.error("Failed to start video call:", error);
      alert("Không thể bắt đầu cuộc gọi video. Vui lòng thử lại.");
    }
  };

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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

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
      <div className="flex-1 flex items-center justify-center bg-[var(--chat-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--chat-bg)]">
      {/* Header */}
      <header className="h-[70px] flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--chat-bg)] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {isMobile && (
            <button 
              onClick={onBack} 
              className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors lg:hidden"
            >
              <ArrowLeft size={24} className="text-white" />
            </button>
          )}
          <div className="relative">
            <div className="avatar-ring w-11 h-11">
              <div className="w-full h-full rounded-full bg-[var(--chat-bg)] overflow-hidden">
                {otherParticipant.avatar_url ? (
                  <img 
                    src={otherParticipant.avatar_url} 
                    alt="" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                    {otherParticipant.display_name?.[0] || otherParticipant.username?.[0]}
                  </div>
                )}
              </div>
            </div>
            {otherParticipant.is_online && (
              <div className="online-indicator absolute bottom-0 right-0" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-[16px] truncate">
                {otherParticipant.display_name || otherParticipant.username}
              </h3>
              <Lock size={14} className="text-[var(--primary)] flex-shrink-0" />
            </div>
            <p className="text-[12px] text-[var(--text-muted)]">
              {isOtherTyping ? (
                <span className="text-[var(--primary)] font-medium">Đang nhập...</span>
              ) : otherParticipant.is_online ? (
                <span className="text-[var(--success)]">Đang hoạt động</span>
              ) : (
                "Ngoại tuyến"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleVideoCall}
            className="p-2.5 hover:bg-white/5 rounded-xl transition-colors group"
          >
            <Video size={22} className="text-[var(--primary)] group-hover:drop-shadow-[0_0_8px_var(--primary-glow)]" />
          </button>
          <button 
            onClick={handleAudioCall}
            className="p-2.5 hover:bg-white/5 rounded-xl transition-colors group"
          >
            <Phone size={22} className="text-[var(--primary)] group-hover:drop-shadow-[0_0_8px_var(--primary-glow)]" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 pt-4 space-y-3 no-scrollbar"
      >
        {/* E2EE Notice */}
        <div className="flex justify-center mb-6">
          <div className="glass-card p-4 rounded-2xl max-w-[85%] flex items-start gap-3">
            <Lock size={16} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
              Tin nhắn và cuộc gọi được mã hóa đầu cuối. Không ai bên ngoài cuộc trò chuyện này có thể đọc hoặc nghe chúng.
            </p>
          </div>
        </div>

        {/* Loading */}
        {isLoadingMessages && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
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
            <div key={msg.id} className="stagger-item" style={{ animationDelay: `${idx * 20}ms` }}>
              {/* Date separator */}
              {showDate && (
                <div className="flex justify-center my-6">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--chat-bg)] px-4 py-1 rounded-full border border-[var(--border)]">
                    {formatDate(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Message bubble */}
              <div className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? "flex-row-reverse" : ""}`}>
                  {/* Avatar for received messages */}
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
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
                        <button 
                          onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                          className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                        >
                          <Smile size={16} className="text-[var(--text-muted)]" />
                        </button>
                        
                        <button 
                          onClick={() => setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id)}
                          className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                        >
                          <MoreVertical size={16} className="text-[var(--text-muted)]" />
                        </button>
                      </div>
                    )}

                    {/* Emoji picker */}
                    {showEmojiPicker === msg.id && (
                      <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-12 glass-card rounded-full px-2 py-1 flex items-center gap-1 shadow-lg z-10`}>
                        {quickEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors text-lg hover:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Context menu */}
                    {activeMessageMenu === msg.id && (
                      <div className={`absolute ${isMe ? "right-0" : "left-0"} top-full mt-1 glass-card rounded-xl shadow-lg overflow-hidden z-10 min-w-[140px]`}>
                        {isMe && canEditMessage(msg.created_at) && (
                          <button
                            onClick={() => handleStartEdit(msg.id, msg.content || msg.encrypted_content || "")}
                            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                          >
                            <Pencil size={14} />
                            Chỉnh sửa
                          </button>
                        )}
                        {isMe && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="w-full px-4 py-2.5 text-left text-sm text-[var(--danger)] hover:bg-white/10 flex items-center gap-2"
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
                          className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10"
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
                          className="px-4 py-2.5 bg-[var(--card)] text-white rounded-xl border border-[var(--primary)] focus:outline-none min-w-[200px]"
                          autoFocus
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={handleCancelEdit} className="text-xs text-[var(--text-muted)] hover:text-white">
                            Hủy
                          </button>
                          <button onClick={handleSaveEdit} className="text-xs text-[var(--primary)] hover:text-[var(--primary-hover)]">
                            Lưu
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Message content */}
                        {isDeleted ? (
                          <div className="px-4 py-2.5 text-[15px] italic text-[var(--text-muted)] bg-[var(--card)] rounded-2xl border border-[var(--border)]">
                            Tin nhắn đã bị thu hồi
                          </div>
                        ) : msg.content_type === "text" ? (
                          <div
                            className={`px-4 py-2.5 text-[15px] leading-relaxed transition-all duration-200 ${
                              isMe
                                ? "bubble-sent"
                                : "bubble-received"
                            }`}
                          >
                            {msg.content || msg.encrypted_content}
                          </div>
                        ) : (
                          <div className="bg-[var(--card)] p-3 rounded-xl flex items-center gap-3 min-w-[200px] border border-[var(--border)]">
                            <div className="w-10 h-10 bg-[var(--danger)]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="text-[var(--danger)]" size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {msg.attachments?.[0]?.file_name || "File"}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
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
                                className="bg-[var(--card)] px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1 border border-[var(--border)]"
                              >
                                {r.emoji} <span className="text-[var(--text-muted)]">{r.count}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Time and status */}
                    <div className={`flex items-center gap-1 mt-1 text-[10px] text-[var(--text-muted)] ${isMe ? "justify-end" : "justify-start"}`}>
                      <span>{formatTime(msg.created_at)}</span>
                      {isEdited && !isDeleted && <span>(đã chỉnh sửa)</span>}
                      {isMe && !isDeleted && (
                        msg.id.startsWith("temp-") ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : msg.status === "read" ? (
                          <CheckCheck size={14} className="text-[var(--primary)]" />
                        ) : (
                          <Check size={14} className="text-[var(--text-muted)]" />
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
          <div className="flex items-center gap-2 animate-in">
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
              {otherParticipant.avatar_url ? (
                <img src={otherParticipant.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                  {otherParticipant.display_name?.[0] || otherParticipant.username?.[0]}
                </div>
              )}
            </div>
            <div className="bg-[var(--card)] px-4 py-2.5 rounded-2xl rounded-bl-md border border-[var(--border)]">
              <div className="flex gap-1">
                <span className="typing-dot w-2 h-2 bg-[var(--text-muted)] rounded-full" />
                <span className="typing-dot w-2 h-2 bg-[var(--text-muted)] rounded-full" />
                <span className="typing-dot w-2 h-2 bg-[var(--text-muted)] rounded-full" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Security Banner */}
      <div className="py-2 flex items-center justify-center gap-2 border-t border-[var(--border)] flex-shrink-0">
        <Shield size={14} className="text-[var(--success)]" />
        <span className="text-[10px] font-bold text-[var(--success)] uppercase tracking-widest font-mono">
          End-to-End Encrypted
        </span>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[var(--chat-bg)] flex items-center gap-3 flex-shrink-0">
        <button className="p-2.5 hover:bg-white/5 rounded-xl transition-colors">
          <ImageIcon size={22} className="text-[var(--text-muted)]" />
        </button>
        <button className="p-2.5 hover:bg-white/5 rounded-xl transition-colors">
          <Paperclip size={22} className="text-[var(--text-muted)]" />
        </button>
        
        <div className="flex-1 relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-full opacity-0 group-focus-within:opacity-50 blur transition-opacity duration-300" />
          <div className="relative bg-[var(--card)] rounded-full px-5 py-3 flex items-center gap-2 border border-[var(--border)] group-focus-within:border-transparent">
            <input
              type="text"
              placeholder="Nhập tin nhắn..."
              className="flex-1 bg-transparent border-none outline-none text-white text-[15px] placeholder:text-[var(--text-muted)]"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isSending}
            />
            <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
              <Smile size={20} className="text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        <button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isSending}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            inputValue.trim() && !isSending
              ? "bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] hover:shadow-lg hover:shadow-[var(--primary-glow)] active:scale-95"
              : "bg-[var(--card)] border border-[var(--border)]"
          }`}
        >
          {isSending ? (
            <Loader2 size={20} className="text-white animate-spin" />
          ) : (
            <Send size={20} className={inputValue.trim() ? "text-white" : "text-[var(--text-muted)]"} />
          )}
        </button>
      </div>
    </div>
  );
}
