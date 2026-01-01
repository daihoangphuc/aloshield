"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cookies from "js-cookie";
import { useAuthStore } from "@/stores/authStore";
import { useConversationsStore } from "@/stores/conversationsStore";
import { useMessagesStore } from "@/stores/messagesStore";
import { useCallStore } from "@/stores/callStore";
import { messagesApi, conversationsApi, Message, callsApi, attachmentsApi } from "@/lib/api";
import { socketManager } from "@/lib/socket";
import { config } from "@/lib/config";
import { ImageModal } from "./ImageModal";
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
  Download,
  Play,
  Reply,
  Layers,
} from "lucide-react";

interface ChatWindowProps {
  conversationId: string;
  onBack: () => void;
  isMobile: boolean;
}

// Component for image message with error handling
function ImageMessageComponent({ 
  attachment, 
  isMe, 
  onImageClick 
}: { 
  attachment: any; 
  isMe: boolean; 
  onImageClick: (url: string, fileName: string) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch image with authentication token
  useEffect(() => {
    const loadImage = async () => {
      try {
        // Use config.apiUrl which already includes /api
        const downloadUrl = `${config.apiUrl}/attachments/${attachment.id}/download`;
        
        // Get token from cookies
        const token = Cookies.get('accessToken');
        
        if (!token) {
          setImageError(true);
          setIsLoading(false);
          return;
        }
        
        // Fetch image with authentication
        const response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status}`);
        }
        
        // Convert to blob URL
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setImageUrl(blobUrl);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load image:', error);
        setImageError(true);
        setIsLoading(false);
      }
    };
    
    loadImage();
    
    // Cleanup blob URL on unmount
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [attachment.id]);

  const handleImageClick = () => {
    if (!imageError && imageUrl) {
      // For modal, we need the original download URL with token
      const downloadUrl = `${config.apiUrl}/attachments/${attachment.id}/download`;
      onImageClick(downloadUrl, attachment.file_name);
    }
  };

  return (
    <div 
      className={`rounded-2xl overflow-hidden cursor-pointer group/img max-w-[280px] relative z-0 ${
        isMe ? "bg-[var(--primary)]/10" : "bg-[var(--card)]"
      } border border-[var(--border)]`}
      onClick={handleImageClick}
    >
      <div className="relative">
        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center gap-2 bg-[var(--card)] min-h-[200px]">
            <Loader2 size={32} className="text-[var(--primary)] animate-spin" />
            <p className="text-xs text-[var(--text-muted)]">Đang tải...</p>
          </div>
        ) : !imageError && imageUrl ? (
          <>
            <img 
              src={imageUrl}
              alt={attachment.file_name}
              className="w-full h-auto max-h-[300px] object-cover"
              loading="lazy"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center z-20 pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-2 bg-black/60 rounded-lg pointer-events-auto">
                <ImageIcon size={20} className="text-white" />
                <span className="text-white text-sm font-medium">Xem ảnh</span>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 flex flex-col items-center justify-center gap-2 bg-[var(--card)] min-h-[200px]">
            <ImageIcon size={32} className="text-[var(--text-muted)]" />
            <p className="text-xs text-[var(--text-muted)]">Không thể tải hình ảnh</p>
          </div>
        )}
      </div>
      {attachment.file_size && (
        <div className="px-3 py-2 flex items-center gap-2 border-t border-[var(--border)] relative z-0">
          <p className="text-xs text-[var(--text-muted)] truncate flex-1">{attachment.file_name}</p>
          <span className="text-[10px] text-[var(--text-muted)]">
            {(attachment.file_size / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>
      )}
    </div>
  );
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
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  
  // Message actions state
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const stickerButtonRef = useRef<HTMLButtonElement>(null);
  const stickerPickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Image modal state
  const [selectedImage, setSelectedImage] = useState<{ url: string; fileName: string } | null>(null);
  
  // Common emoji reactions
  const quickEmojis = ["❤️", "😂", "😮", "😢", "😡", "👍"];
  
  // Sticker packs - using emoji as stickers for now
  const stickerPacks = [
    { name: "Cảm xúc", stickers: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙"] },
    { name: "Thú cưng", stickers: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆"] },
    { name: "Thức ăn", stickers: ["🍎", "🍌", "🍇", "🍓", "🍉", "🍑", "🍒", "🥝", "🍅", "🥑", "🍔", "🍕", "🌮", "🌯", "🍗", "🍖", "🥩", "🍟", "🍿", "🍰"] },
    { name: "Hoạt động", stickers: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸", "🥊", "🎯", "🎮", "🎲", "🃏", "🎴", "🎨", "🎭", "🎪", "🎬"] },
    { name: "Biểu tượng", stickers: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️"] },
  ];

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
        
        // Mark unread messages from others as read via socket - IMMEDIATELY
        const unreadMessages = messagesWithContent.filter(
          (msg: Message) => msg.sender_id !== user?.id && msg.status !== "read"
        );
        
        if (unreadMessages.length > 0) {
          console.log(`📖 Marking ${unreadMessages.length} messages as read`);
          // Mark all unread messages as read immediately
          unreadMessages.forEach((msg: Message) => {
            socketManager.markAsRead(msg.id);
          });
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    loadMessages();
  }, [conversationId, setMessages, setHasMore, updateUnreadCount, user?.id]);

  // 🔥 Mark new messages as read when they arrive while user is in this conversation
  useEffect(() => {
    if (!conversationId || !user?.id) return;
    
    // ✅ CRITICAL: Only mark as read if this conversation is currently active
    const { activeConversationId } = useConversationsStore.getState();
    if (activeConversationId !== conversationId) {
      // User is not viewing this conversation - don't mark as read
      return;
    }
    
    // Get the latest message that's not from me and not yet read
    const latestUnreadFromOthers = conversationMessages
      .filter(msg => msg.sender_id !== user.id && msg.status !== "read" && !msg.id.startsWith("temp-"))
      .slice(-1)[0];
    
    if (latestUnreadFromOthers) {
      console.log("📖 New unread message detected, marking as read:", latestUnreadFromOthers.id);
      // Double-check activeConversationId before marking as read
      const currentActiveConvId = useConversationsStore.getState().activeConversationId;
      if (currentActiveConvId === conversationId) {
        socketManager.markAsRead(latestUnreadFromOthers.id);
      } else {
        console.log("⏭️ User left conversation, skipping mark as read in useEffect");
      }
    }
  }, [conversationMessages, conversationId, user?.id]);

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

  // Send both file and text message together
  const handleSendAll = async () => {
    if ((!inputValue.trim() && !selectedFile) || isSending || isUploading || !otherParticipant) return;
    
    // If there's a file, send it first
    if (selectedFile) {
      await handleSendFile();
    }
    
    // If there's text, send it after
    if (inputValue.trim()) {
      await handleSendMessage();
    }
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
        replyToMessageId: replyToMessage?.id,
      });
      
      // Clear reply after sending
      if (replyToMessage) {
        setReplyToMessage(null);
      }
      
      if (sentMessage) {
        // ✅ Ensure own messages always start with "sent" status
        const messageWithCorrectStatus = {
          ...sentMessage,
          status: "sent" as const, // Force "sent" status for own new messages
        };
        updateLastMessage(conversationId, messageWithCorrectStatus as Message);
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

  const handleSelectSticker = (sticker: string) => {
    // Insert sticker into input field instead of sending immediately
    setInputValue(prev => prev + sticker);
    setShowStickerPicker(false);
    
    // Focus on textarea after inserting sticker
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Move cursor to end of text
        const length = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(length, length);
      }
    }, 0);
  };

  // File handling functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      alert("Tệp quá lớn. Kích thước tối đa là 100MB");
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (isImage && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // Handle file from drag & drop or paste
  const handleFileFromDrop = (file: File) => {
    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      alert("Tệp quá lớn. Kích thước tối đa là 100MB");
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileFromDrop(files[0]);
    }
  };

  // Handle paste event for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleFileFromDrop(file);
            break;
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // Close sticker picker when clicking outside
  useEffect(() => {
    if (!showStickerPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        stickerButtonRef.current &&
        !stickerButtonRef.current.contains(target) &&
        stickerPickerRef.current &&
        !stickerPickerRef.current.contains(target)
      ) {
        setShowStickerPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showStickerPicker]);

  const handleSendFile = async () => {
    if (!selectedFile || isUploading || !otherParticipant) return;

    setIsUploading(true);

    try {
      // Upload file to R2
      const uploadResult = await attachmentsApi.upload(conversationId, selectedFile) as {
        attachmentId: string;
        r2Key: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
      };

      // Determine content type
      let contentType: "image" | "video" | "audio" | "file" = "file";
      if (selectedFile.type.startsWith("image/")) contentType = "image";
      else if (selectedFile.type.startsWith("video/")) contentType = "video";
      else if (selectedFile.type.startsWith("audio/")) contentType = "audio";

      const tempId = `temp-${Date.now()}`;
      const tempMessage: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user?.id || "",
        encrypted_content: `[${contentType}] ${selectedFile.name}`,
        content: `[${contentType}] ${selectedFile.name}`,
        content_type: contentType,
        session_version: 1,
        ratchet_step: 0,
        created_at: new Date().toISOString(),
        sender: user || undefined,
        attachments: [{
          id: uploadResult.attachmentId,
          r2_key: uploadResult.r2Key,
          file_name: uploadResult.fileName,
          file_size: uploadResult.fileSize,
          mime_type: uploadResult.mimeType,
        }],
      };

      addMessage(tempMessage);

      // Send message via socket with attachment info
      const sentMessage = await socketManager.sendMessage({
        conversationId,
        encryptedContent: `[${contentType}] ${selectedFile.name}`,
        contentType,
        sessionVersion: 1,
        ratchetStep: 0,
        tempId,
        recipientId: otherParticipant.id,
        attachments: [{
          attachmentId: uploadResult.attachmentId,
          encryptedFileKey: "",
        }],
      });

      if (sentMessage) {
        // ✅ Ensure own messages always start with "sent" status
        const messageWithCorrectStatus = {
          ...sentMessage,
          status: "sent" as const, // Force "sent" status for own new messages
        };
        updateLastMessage(conversationId, messageWithCorrectStatus as Message);
      }

      clearSelectedFile();
    } catch (error) {
      console.error("Failed to send file:", error);
      alert("Không thể gửi tệp. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
    try {
      // Use backend download endpoint to ensure proper Content-Disposition header
      // This preserves the original file extension and name
      const token = Cookies.get("accessToken");
      const downloadUrl = `${config.apiUrl}/attachments/${attachmentId}/download`;
      
      // Fetch file with authentication
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      // Get blob from response
      const blob = await response.blob();
      
      // Get filename from Content-Disposition header if available, otherwise use provided filename
      const contentDisposition = response.headers.get('Content-Disposition');
      let finalFileName = fileName;
      
      if (contentDisposition) {
        // Try to get filename* (UTF-8 encoded) first, then fallback to filename
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
        if (filenameStarMatch && filenameStarMatch[1]) {
          // Decode URI encoded filename from filename*
          finalFileName = decodeURIComponent(filenameStarMatch[1]);
        } else {
          // Fallback to regular filename
          const fileNameMatch = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
          if (fileNameMatch && fileNameMatch[1]) {
            finalFileName = fileNameMatch[1];
            // Decode if it's URI encoded
            try {
              finalFileName = decodeURIComponent(finalFileName);
            } catch (e) {
              // If decode fails, use as is
            }
          }
        }
      }
      
      // Ensure filename has extension if not present
      // Use original fileName as fallback if parsed name doesn't have extension
      if (!finalFileName.includes('.') && fileName.includes('.')) {
        finalFileName = fileName;
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = finalFileName; // Use filename from header to preserve extension
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download attachment:", error);
      alert("Không thể tải tệp. Vui lòng thử lại.");
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
    <div 
      className={`flex-1 flex flex-col ${isMobile ? 'h-screen' : 'h-full'} bg-[var(--chat-bg)] relative overflow-hidden`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[var(--chat-bg)]/95 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-[var(--primary)] rounded-xl m-2">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--primary)]/20 flex items-center justify-center">
              <Paperclip size={40} className="text-[var(--primary)]" />
            </div>
            <p className="text-xl font-bold text-white mb-2">Thả tệp vào đây</p>
            <p className="text-sm text-[var(--text-muted)]">Hỗ trợ hình ảnh, video, tài liệu (tối đa 100MB)</p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className={`h-[70px] md:h-[80px] flex items-center justify-between px-3 md:px-6 border-b border-[var(--border)] bg-[var(--chat-bg)]/80 backdrop-blur-xl flex-shrink-0 z-10 ${isMobile ? 'sticky top-0' : ''}`}>
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1 overflow-hidden">
          {isMobile && (
            <button 
              onClick={onBack} 
              className="p-2 -ml-1 hover:bg-white/5 rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft size={22} className="text-white" />
            </button>
          )}
          <div className="relative flex-shrink-0">
            <div className="avatar-ring w-10 h-10 md:w-12 md:h-12 transition-transform duration-300 hover:scale-105">
              <div className="w-full h-full rounded-full bg-[var(--chat-bg)] overflow-hidden">
                {otherParticipant.avatar_url ? (
                  <img 
                    src={otherParticipant.avatar_url} 
                    alt="" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-black text-lg md:text-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                    {otherParticipant.display_name?.[0] || otherParticipant.username?.[0]}
                  </div>
                )}
              </div>
            </div>
            {otherParticipant.is_online && (
              <div className="online-indicator absolute bottom-0 right-0 border-2 border-[var(--chat-bg)]" />
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1.5 md:gap-2">
              <h3 className="font-bold text-white text-[15px] md:text-[17px] truncate tracking-tight max-w-[120px] sm:max-w-[180px] md:max-w-none">
                {otherParticipant.display_name || otherParticipant.username}
              </h3>
              <div className="px-1 py-0.5 rounded-md bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex-shrink-0">
                <Lock size={10} className="text-[var(--primary)]" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {isOtherTyping ? (
                <div className="flex gap-1 items-center px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 animate-pulse">
                  <span className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-wider">Đang nhập</span>
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 bg-[var(--primary)] rounded-full animate-bounce" />
                    <span className="w-1 h-1 bg-[var(--primary)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1 h-1 bg-[var(--primary)] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              ) : otherParticipant.is_online ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_var(--success-glow)]" />
                  <span className="text-[11px] text-[var(--success)] font-medium">Đang hoạt động</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">Ngoại tuyến</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 md:gap-2 flex-shrink-0">
          <button 
            onClick={handleVideoCall}
            className="p-2 md:p-2.5 hover:bg-white/5 rounded-xl transition-all group active:scale-90"
            title="Cuộc gọi video"
          >
            <Video size={20} className="text-[var(--primary)] group-hover:drop-shadow-[0_0_8px_var(--primary-glow)] transition-all" />
          </button>
          <button 
            onClick={handleAudioCall}
            className="p-2 md:p-2.5 hover:bg-white/5 rounded-xl transition-all group active:scale-90"
            title="Cuộc gọi âm thanh"
          >
            <Phone size={20} className="text-[var(--primary)] group-hover:drop-shadow-[0_0_8px_var(--primary-glow)] transition-all" />
          </button>
          <button className="p-2 md:p-2.5 hover:bg-white/5 rounded-xl transition-all group active:scale-90">
            <MoreVertical size={20} className="text-[var(--text-muted)] group-hover:text-white" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 md:px-4 pt-4 space-y-3 no-scrollbar"
      >
        {/* E2EE Notice */}
        <div className="flex justify-center mb-4 md:mb-6">
          <div className="glass-card p-3 md:p-4 rounded-2xl max-w-[90%] md:max-w-[85%] flex items-start gap-2 md:gap-3">
            <Lock size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] md:text-[12px] text-[var(--text-muted)] leading-relaxed">
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
                <div className="flex justify-center my-4 md:my-6">
                  <span className="text-[10px] md:text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--chat-bg)] px-3 md:px-4 py-1 rounded-full border border-[var(--border)]">
                    {formatDate(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Message bubble */}
              <div className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                <div className={`flex items-end gap-1.5 md:gap-2 max-w-[85%] md:max-w-[75%] ${isMe ? "flex-row-reverse" : ""}`}>
                  {/* Avatar for received messages */}
                  {!isMe && (
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                      {msg.sender?.avatar_url ? (
                        <img src={msg.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold">
                          {msg.sender?.display_name?.[0] || msg.sender?.username?.[0]}
                        </div>
                      )}
                    </div>
                  )}

                  <div 
                    ref={(el) => { messageRefs.current[msg.id] = el; }}
                    className={`flex flex-col relative ${activeMessageMenu === msg.id ? 'z-0' : ''}`}
                  >
                    {/* Message actions (hover menu) */}
                    {!isDeleted && !msg.id.startsWith("temp-") && (
                      <div className={`absolute top-0 ${isMe ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10`}>
                        <button 
                          onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                          className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                        >
                          <Smile size={16} className="text-[var(--text-muted)]" />
                        </button>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const messageEl = messageRefs.current[msg.id];
                            if (messageEl) {
                              const rect = messageEl.getBoundingClientRect();
                              // Position menu right below the message bubble
                              // Use getBoundingClientRect which returns viewport coordinates for fixed positioning
                              if (isMe) {
                                setMenuPosition({ 
                                  top: rect.bottom + 4, 
                                  right: window.innerWidth - rect.right 
                                });
                              } else {
                                setMenuPosition({ 
                                  top: rect.bottom + 4, 
                                  left: rect.left 
                                });
                              }
                            }
                            setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id);
                          }}
                          className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                        >
                          <MoreVertical size={16} className="text-[var(--text-muted)]" />
                        </button>
                      </div>
                    )}

                    {/* Emoji picker */}
                    {showEmojiPicker === msg.id && (
                      <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-12 glass-card rounded-full px-2 py-1 flex items-center gap-1 shadow-lg z-[80]`}>
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
                            className={`px-4 py-2.5 text-[15px] leading-relaxed transition-all duration-200 relative ${
                              isMe
                                ? "bubble-sent"
                                : "bubble-received"
                            }`}
                            style={{ zIndex: activeMessageMenu === msg.id ? 0 : 'auto' }}
                          >
                            {msg.content || msg.encrypted_content}
                          </div>
                        ) : msg.content_type === "image" && msg.attachments?.[0] ? (
                          <ImageMessageComponent
                            attachment={msg.attachments[0]}
                            isMe={isMe}
                            onImageClick={(url, fileName) => {
                              setSelectedImage({ url, fileName });
                            }}
                          />
                        ) : msg.content_type === "video" && msg.attachments?.[0] ? (
                          <div 
                            className={`rounded-2xl overflow-hidden cursor-pointer group/vid max-w-[300px] ${
                              isMe ? "bg-[var(--primary)]/10" : "bg-[var(--card)]"
                            } border border-[var(--border)]`}
                            onClick={() => handleDownloadAttachment(msg.attachments![0].id, msg.attachments![0].file_name)}
                          >
                            <div className="relative bg-black/30 p-8 flex items-center justify-center min-h-[150px]">
                              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                                <Play size={28} className="text-white ml-1" />
                              </div>
                            </div>
                            <div className="px-3 py-2 flex items-center gap-2">
                              <Video size={16} className="text-[var(--primary)]" />
                              <p className="text-xs text-[var(--text-muted)] truncate flex-1">{msg.attachments[0].file_name}</p>
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {(msg.attachments[0].file_size / 1024 / 1024).toFixed(1)} MB
                              </span>
                            </div>
                          </div>
                        ) : msg.attachments?.[0] ? (
                          <div 
                            className={`p-3 rounded-2xl flex items-center gap-3 min-w-[220px] max-w-[300px] cursor-pointer hover:bg-white/5 transition-colors ${
                              isMe ? "bg-[var(--primary)]/10 border border-[var(--primary)]/20" : "bg-[var(--card)] border border-[var(--border)]"
                            }`}
                            onClick={() => handleDownloadAttachment(msg.attachments![0].id, msg.attachments![0].file_name)}
                          >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              msg.content_type === "audio" 
                                ? "bg-[var(--accent)]/20" 
                                : "bg-[var(--danger)]/20"
                            }`}>
                              {msg.content_type === "audio" ? (
                                <Play className="text-[var(--accent)]" size={22} />
                              ) : (
                                <FileText className="text-[var(--danger)]" size={22} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {msg.attachments[0].file_name}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {(msg.attachments[0].file_size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <Download size={18} className="text-[var(--text-muted)] flex-shrink-0" />
                          </div>
                        ) : !msg.attachments?.[0] && (msg.content_type === "file" || msg.content_type === "image" || msg.content_type === "video" || msg.content_type === "audio") ? (
                          // File/media message but attachments not loaded yet - show file info with download icon (disabled)
                          // Parse filename from content if available (format: "[file] filename" or "[image] filename" etc)
                          (() => {
                            const content = msg.content || msg.encrypted_content || "";
                            const fileNameMatch = content.match(/\[(file|image|video|audio)\] (.+)/);
                            const fileName = fileNameMatch ? fileNameMatch[2] : "Tệp đính kèm";
                            return (
                              <div 
                                className={`p-3 rounded-2xl flex items-center gap-3 min-w-[220px] max-w-[300px] ${
                                  isMe ? "bg-[var(--primary)]/10 border border-[var(--primary)]/20" : "bg-[var(--card)] border border-[var(--border)]"
                                }`}
                              >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                  msg.content_type === "image"
                                    ? "bg-[var(--primary)]/20"
                                    : msg.content_type === "video"
                                    ? "bg-purple-500/20"
                                    : msg.content_type === "audio"
                                    ? "bg-[var(--accent)]/20"
                                    : "bg-[var(--danger)]/20"
                                }`}>
                                  {msg.content_type === "image" ? (
                                    <ImageIcon className="text-[var(--primary)]" size={22} />
                                  ) : msg.content_type === "video" ? (
                                    <Video className="text-purple-400" size={22} />
                                  ) : msg.content_type === "audio" ? (
                                    <Play className="text-[var(--accent)]" size={22} />
                                  ) : (
                                    <FileText className="text-[var(--danger)]" size={22} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-white truncate">
                                    {fileName}
                                  </p>
                                  <p className="text-xs text-[var(--text-muted)]">Đang tải thông tin...</p>
                                </div>
                                <Download size={18} className="text-[var(--text-muted)]/50 flex-shrink-0" />
                              </div>
                            );
                          })()
                        ) : (
                          // Fallback for text messages without content
                          <div
                            className={`px-4 py-2.5 text-[15px] leading-relaxed transition-all duration-200 ${
                              isMe ? "bubble-sent" : "bubble-received"
                            }`}
                          >
                            {msg.content || msg.encrypted_content || "..."}
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
      <div className="py-2.5 flex items-center justify-center gap-2 border-t border-[var(--border)] bg-black/20 flex-shrink-0">
        <div className="relative flex items-center justify-center">
          <Shield size={12} className="text-[var(--success)] relative z-10" />
          <div className="absolute inset-0 bg-[var(--success)]/20 blur-sm rounded-full animate-pulse" />
        </div>
        <span className="text-[9px] md:text-[10px] font-black text-[var(--success)]/80 uppercase tracking-[0.2em] font-mono">
          End-to-End Encrypted Protection
        </span>
      </div>

      {/* Sticker Picker */}
      {showStickerPicker && (
        <div ref={stickerPickerRef} className="border-t border-[var(--border)] bg-[var(--card)] p-3 md:p-4 flex-shrink-0">
          <div className="max-h-[300px] overflow-y-auto">
            {stickerPacks.map((pack, packIndex) => (
              <div key={packIndex} className="mb-4 last:mb-0">
                <h4 className="text-xs font-semibold text-[var(--text-muted)] mb-2 px-1 uppercase tracking-wider">
                  {pack.name}
                </h4>
                <div className="grid grid-cols-8 md:grid-cols-10 gap-2">
                  {pack.stickers.map((sticker, stickerIndex) => (
                    <button
                      key={stickerIndex}
                      onClick={() => handleSelectSticker(sticker)}
                      className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-2xl md:text-3xl hover:bg-white/10 rounded-xl transition-all active:scale-90 hover:scale-110"
                      title={sticker}
                    >
                      {sticker}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reply Preview - Floating above input */}
      {replyToMessage && (
        <div className="mx-3 md:mx-4 mb-2 animate-in slide-in-from-bottom-2 duration-200">
          <div className="bg-[#1a1f2e] border-l-4 border-[var(--primary)] rounded-xl p-3 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Reply size={16} className="text-[var(--primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--primary)] mb-1">
                  {replyToMessage.sender?.display_name || replyToMessage.sender?.username || "Người dùng"}
                </p>
                <p className="text-sm text-white line-clamp-2">
                  {replyToMessage.content || replyToMessage.encrypted_content || "[Tin nhắn đã bị xóa]"}
                </p>
              </div>
              <button
                onClick={() => setReplyToMessage(null)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                title="Hủy trả lời"
              >
                <X size={16} className="text-[var(--text-muted)] hover:text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview - Floating above input */}
      {selectedFile && (
        <div className="mx-3 md:mx-4 mb-2 animate-in slide-in-from-bottom-2 duration-200">
          <div className="bg-[#1a1f2e] border border-[var(--border)] rounded-2xl p-3 shadow-xl">
            <div className="flex items-center gap-3">
              {/* File icon/preview */}
              <div className="relative flex-shrink-0">
                {filePreview ? (
                  <div className="relative">
                    <img 
                      src={filePreview} 
                      alt="Preview" 
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    <div className="absolute inset-0 rounded-xl ring-1 ring-white/10" />
                  </div>
                ) : (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    selectedFile.type.startsWith("video/") 
                      ? "bg-purple-500/20" 
                      : selectedFile.type.startsWith("audio/")
                        ? "bg-green-500/20"
                        : selectedFile.type.includes("pdf")
                          ? "bg-red-500/20"
                          : "bg-blue-500/20"
                  }`}>
                    {selectedFile.type.startsWith("video/") ? (
                      <Video size={22} className="text-purple-400" />
                    ) : selectedFile.type.startsWith("audio/") ? (
                      <Play size={22} className="text-green-400" />
                    ) : selectedFile.type.includes("pdf") ? (
                      <FileText size={22} className="text-red-400" />
                    ) : (
                      <FileText size={22} className="text-blue-400" />
                    )}
                  </div>
                )}
              </div>
              
              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {selectedFile.size < 1024 * 1024 
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                    : `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                  }
                </p>
              </div>
              
              {/* Cancel button only - send will use main button */}
              <button
                onClick={clearSelectedFile}
                className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                title="Hủy đính kèm"
              >
                <X size={18} className="text-[var(--text-muted)] hover:text-white" />
              </button>
            </div>
            
            {/* Upload progress bar */}
            {isUploading && (
              <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className={`p-3 md:p-4 bg-[var(--chat-bg)] flex items-end gap-2 md:gap-3 flex-shrink-0 border-t border-[var(--border)] ${isMobile ? 'pb-4' : ''}`} style={isMobile ? { paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' } : undefined}>
        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, true)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, false)}
        />
        
        <div className="flex items-center flex-shrink-0">
          <button 
            onClick={() => imageInputRef.current?.click()}
            className="p-2 md:p-2.5 hover:bg-white/5 rounded-xl transition-all active:scale-90" 
            title="Đính kèm hình ảnh"
          >
            <ImageIcon size={20} className="text-[var(--text-muted)] hover:text-[var(--primary)]" />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 md:p-2.5 hover:bg-white/5 rounded-xl transition-all active:scale-90" 
            title="Đính kèm tệp"
          >
            <Paperclip size={20} className="text-[var(--text-muted)] hover:text-[var(--primary)]" />
          </button>
        </div>
        
        <div className="flex-1 min-w-0 relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-[20px] md:rounded-[24px] opacity-0 group-focus-within:opacity-30 blur-sm transition-opacity duration-500" />
          <div className="relative bg-[#0d1117] rounded-[20px] md:rounded-[24px] px-4 py-2.5 md:py-3 flex items-center gap-2 border border-[var(--border)] group-focus-within:border-[var(--primary)]/50 transition-all duration-300">
            <textarea
              ref={textareaRef}
              placeholder="Nhập tin nhắn..."
              className="flex-1 bg-transparent border-none outline-none text-white text-[14px] md:text-[15px] placeholder:text-[var(--text-muted)] resize-none max-h-24 min-h-[20px] overflow-y-auto"
              rows={1}
              value={inputValue}
              onChange={(e) => {
                handleInputChange(e as any);
                // Auto resize height
                e.target.style.height = 'inherit';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendAll();
                }
              }}
              disabled={isSending || isUploading}
            />
            <button 
              ref={stickerButtonRef}
              onClick={() => setShowStickerPicker(!showStickerPicker)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors active:scale-90 flex-shrink-0 relative"
            >
              <Layers size={18} className="text-[var(--text-muted)] hover:text-white" />
            </button>
          </div>
        </div>

        <button
          onClick={handleSendAll}
          disabled={(!inputValue.trim() && !selectedFile) || isSending || isUploading}
          className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
            (inputValue.trim() || selectedFile) && !isSending && !isUploading
              ? "bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg shadow-[var(--primary-glow)] hover:scale-105 active:scale-95"
              : "bg-[var(--card)] border border-[var(--border)] text-[var(--text-muted)]"
          }`}
        >
          {isSending || isUploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} className={(inputValue.trim() || selectedFile) ? "translate-x-0.5 -translate-y-0.5" : ""} />
          )}
        </button>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage.url}
          fileName={selectedImage.fileName}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {/* Context menu - Fixed position to ensure it's always on top */}
      {activeMessageMenu && menuPosition && (() => {
        const msg = conversationMessages.find(m => m.id === activeMessageMenu);
        if (!msg) return null;
        const isMe = msg.sender_id === user?.id;
        
        return createPortal(
          <div 
            className="fixed glass-card rounded-xl shadow-2xl z-[100] min-w-[140px] pointer-events-auto"
            style={{
              top: `${menuPosition.top}px`,
              ...(menuPosition.left !== undefined ? { left: `${menuPosition.left}px` } : {}),
              ...(menuPosition.right !== undefined ? { right: `${menuPosition.right}px` } : {}),
              transform: 'translateY(0)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-xl">
              {!isMe && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplyToMessage(msg);
                    setActiveMessageMenu(null);
                    setMenuPosition(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Reply size={14} />
                  Trả lời
                </button>
              )}
              {isMe && canEditMessage(msg.created_at) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(msg.id, msg.content || msg.encrypted_content || "");
                    setActiveMessageMenu(null);
                    setMenuPosition(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Pencil size={14} />
                  Chỉnh sửa
                </button>
              )}
              {isMe && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMessage(msg.id);
                    setActiveMessageMenu(null);
                    setMenuPosition(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-[var(--danger)] hover:bg-white/10 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Trash2 size={14} />
                  Thu hồi
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(msg.content || msg.encrypted_content || "");
                  setActiveMessageMenu(null);
                  setMenuPosition(null);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 cursor-pointer transition-colors"
              >
                Sao chép
              </button>
            </div>
          </div>,
          document.body
        );
      })()}
      
      {/* Click outside to close menu */}
      {activeMessageMenu && (
        <div 
          className="fixed inset-0 z-[99]"
          onClick={() => {
            setActiveMessageMenu(null);
            setMenuPosition(null);
          }}
        />
      )}
    </div>
  );
}
