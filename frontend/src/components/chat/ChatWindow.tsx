"use client";

import { useEffect, useRef, useState, useMemo, useCallback, lazy, Suspense } from "react";
import Cookies from "js-cookie";
import { useAuthStore } from "@/stores/authStore";
import { useConversationsStore } from "@/stores/conversationsStore";
import { useMessagesStore } from "@/stores/messagesStore";
import { useCallStore } from "@/stores/callStore";
import { messagesApi, conversationsApi, Message, callsApi, attachmentsApi } from "@/lib/api";
import { socketManager } from "@/lib/socket";
import { config } from "@/lib/config";
import {
  Loader2,
  Maximize2,
  PhoneOff,
  Video,
  Phone,
} from "lucide-react";

// Components
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
// Lazy load ImageModal
const ImageModal = lazy(() => import("./ImageModal").then(m => ({ default: m.ImageModal })));

interface ChatWindowProps {
  conversationId: string;
  onBack: () => void;
  isMobile: boolean;
}

// --- Minimized Call Components (kept here for now, could be moved to separate file) ---
function MinimizedAudioCall({
  recipientName,
  onMaximize,
  onEndCall,
}: {
  recipientName: string;
  onMaximize: () => void;
  onEndCall: () => void;
}) {
  const { callDuration } = useCallStore();
  const [timer, setTimer] = useState("00:00");

  useEffect(() => {
    const start = Date.now() - callDuration * 1000;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
      const secs = (elapsed % 60).toString().padStart(2, "0");
      setTimer(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [callDuration]);

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[90] bg-gradient-to-r from-[var(--primary)]/90 to-[var(--accent)]/90 backdrop-blur-xl border-b border-white/10 shadow-2xl"
      style={{
        top: 'env(safe-area-inset-top, 0px)',
        paddingTop: 'max(0.75rem, calc(0.75rem + env(safe-area-inset-top, 0px)))',
        paddingBottom: '0.75rem',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left, 0px))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right, 0px))',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{recipientName}</p>
            <p className="text-white/80 text-xs font-mono">{timer} • Encrypted</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Trở lại cuộc gọi
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEndCall();
            }}
            className="p-2 bg-[var(--danger)]/80 hover:bg-[var(--danger)] rounded-lg transition-colors"
            title="Kết thúc cuộc gọi"
          >
            <PhoneOff size={18} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MinimizedVideoCall({
  remoteStream,
  localStream,
  recipientName,
  onMaximize,
  onEndCall,
}: {
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  recipientName: string;
  onMaximize: () => void;
  onEndCall: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const streamToUse = remoteStream || localStream;
    
    if (streamToUse) {
      videoEl.srcObject = streamToUse;
      videoEl.muted = !remoteStream;
      videoEl.play().catch(e => console.error("Error playing minimized video:", e));
    } else {
      videoEl.srcObject = null;
    }
    return () => { if (videoEl) videoEl.srcObject = null; };
  }, [remoteStream, localStream]);

  return (
    <div 
      className="fixed z-[90] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black animate-in cursor-pointer group"
      style={{
        top: 'max(5rem, calc(5rem + env(safe-area-inset-top, 0px)))',
        right: 'max(1rem, calc(1rem + env(safe-area-inset-right, 0px)))',
        width: '8rem',
        height: '12rem',
      }}
    >
      {(remoteStream || localStream) ? (
        <video ref={videoRef} autoPlay playsInline muted={!remoteStream} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[var(--card)]">
          <Video className="text-white/20 w-10 h-10" />
          <p className="text-white/40 text-xs mt-2">Đang chờ video...</p>
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onMaximize(); }}
          className="self-end p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
        >
          <Maximize2 size={14} className="text-white" />
        </button>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEndCall(); }}
            className="p-2 bg-[var(--danger)]/80 rounded-full hover:bg-[var(--danger)] transition-colors"
          >
            <PhoneOff size={14} className="text-white" />
          </button>
        </div>
      </div>
      <div className="absolute bottom-2 left-2 right-2 px-2 py-1 bg-black/60 rounded-lg backdrop-blur-sm">
        <p className="text-[10px] font-semibold text-white truncate">{recipientName}</p>
      </div>
      <div className="absolute inset-0" onClick={onMaximize} />
    </div>
  );
}

export function ChatWindow({ conversationId, onBack, isMobile }: ChatWindowProps) {
  const { user } = useAuthStore();
  const { conversations, typingUsers, updateUnreadCount, updateLastMessage } = useConversationsStore();
  const { messages, setMessages, addMessage, setHasMore, deleteMessage } = useMessagesStore();
  const { initiateCall, initializePeerConnection, createOffer, iceServers, currentCall, remoteStream, isMinimized, toggleMinimize, endCall, localStream } = useCallStore();

  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTypingLocal, setIsTypingLocal] = useState(false);

  // Mobile UI state
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // File & Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Map<string, string>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  
  // Image Modal
  const [selectedImage, setSelectedImage] = useState<{ url: string; fileName: string } | null>(null);
  
  // Reply State
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);

  // Memoized Data
  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId]
  );
  
  const conversationMessages = useMemo(
    () => messages[conversationId] || [],
    [messages, conversationId]
  );
  
  const otherParticipant = useMemo(
    () => conversation?.participants.find((p) => p.user_id !== user?.id)?.user,
    [conversation?.participants, user?.id]
  );

  const isOtherTyping = useMemo(
    () => (typingUsers[conversationId]?.size || 0) > 0,
    [typingUsers, conversationId]
  );

  // 1. Initial Data Load & Read Status
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
        setIsLoadingMessages(false);
      }
    };
    loadMessages();
  }, [conversationId, setMessages, setHasMore, updateUnreadCount, user?.id]);

  // 2. Realtime Read Marking
  useEffect(() => {
    if (!conversationId || !user?.id) return;
    const { activeConversationId } = useConversationsStore.getState();
    if (activeConversationId !== conversationId) return;
    
    const latestUnreadFromOthers = conversationMessages
      .filter(msg => msg.sender_id !== user.id && msg.status !== "read" && !msg.id.startsWith("temp-"))
      .slice(-1)[0];
    
    if (latestUnreadFromOthers) {
      const currentActiveConvId = useConversationsStore.getState().activeConversationId;
      if (currentActiveConvId === conversationId) {
        socketManager.markAsRead(latestUnreadFromOthers.id);
      }
    }
  }, [conversationMessages, conversationId, user?.id]);

  // 3. Mobile Viewport / Keyboard Handling
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );

  useEffect(() => {
    if (!isMobile) return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        
        // Calculate keyboard height if needed (optional now)
        const windowHeight = window.innerHeight;
        const heightDiff = windowHeight - window.visualViewport.height;
        if (heightDiff > 100) {
          setKeyboardHeight(heightDiff);
        } else {
          setKeyboardHeight(0);
        }
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    window.addEventListener('resize', handleResize);

    // Initial set
    handleResize();

    return () => {
      if (window.visualViewport) {
         window.visualViewport.removeEventListener('resize', handleResize);
         window.visualViewport.removeEventListener('scroll', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  // 3b. Add chat-page class to body for global styles
  useEffect(() => {
    document.body.classList.add('chat-page');
    return () => {
        document.body.classList.remove('chat-page');
    };
  }, []);

  // 4. Focus Handling
  useEffect(() => {
    if (!isMobile || !textareaRef.current) return;
    const textarea = textareaRef.current;

    const handleFocus = () => setIsInputFocused(true);
    const handleBlur = () => {
      setTimeout(() => {
        if (document.activeElement !== textarea) {
          setIsInputFocused(false);
          setKeyboardHeight(0);
        }
      }, 150);
    };

    textarea.addEventListener('focus', handleFocus);
    textarea.addEventListener('blur', handleBlur);
    return () => {
      textarea.removeEventListener('focus', handleFocus);
      textarea.removeEventListener('blur', handleBlur);
    };
  }, [isMobile]);

  // 5. Typing Logic
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    if (!isTypingLocal && value.length > 0) {
      setIsTypingLocal(true);
      socketManager.startTyping(conversationId);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingLocal((prev) => {
        if (prev) {
          socketManager.stopTyping(conversationId);
          return false;
        }
        return prev;
      });
    }, 2000);
  }, [conversationId, isTypingLocal]);

  // 6. Sending Logic (Text & Files)
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending || !otherParticipant) return;
    
    const content = inputValue.trim();
    if (textareaRef.current) textareaRef.current.focus();
    
    setInputValue("");
    setIsSending(true);

    if (isTypingLocal) {
      setIsTypingLocal(false);
      socketManager.stopTyping(conversationId);
    }

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message & { _renderKey?: string } = {
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
      status: "sent",
      _renderKey: tempId,
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
      
      if (replyToMessage) setReplyToMessage(null);
      if (sentMessage) {
        updateLastMessage(conversationId, { ...sentMessage, status: "sent" } as Message);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      deleteMessage(conversationId, tempId);
      alert("Không thể gửi tin nhắn. Vui lòng thử lại.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendFile = async () => {
    if (selectedFiles.length === 0 || isUploading || !otherParticipant) return;
    setIsUploading(true);
    const filesToSend = [...selectedFiles];

    try {
        const uploadPromises = filesToSend.map(async (file) => {
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

        const sendPromises = uploadResults.map(async ({ file, uploadResult }, index) => {
            const tempId = `temp-${Date.now()}-${index}`;
            let fileContentType: "image" | "video" | "audio" | "file" = "file";
            if (file.type.startsWith("image/")) fileContentType = "image";
            else if (file.type.startsWith("video/")) fileContentType = "video";
            else if (file.type.startsWith("audio/")) fileContentType = "audio";

            const tempMessage: Message & { _renderKey?: string } = {
                id: tempId,
                conversation_id: conversationId,
                sender_id: user?.id || "",
                encrypted_content: `[${fileContentType}] ${file.name}`,
                content: `[${fileContentType}] ${file.name}`,
                content_type: fileContentType,
                session_version: 1,
                ratchet_step: 0,
                created_at: new Date().toISOString(),
                sender: user || undefined,
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
                recipientId: otherParticipant.id,
                attachments: [{
                    attachmentId: uploadResult.attachmentId,
                    encryptedFileKey: "",
                }],
            });

            if (sentMessage) {
                updateLastMessage(conversationId, { ...sentMessage, status: "sent" } as Message);
            }
        });

        await Promise.all(sendPromises);
        handleClearFile();
    } catch (error) {
        console.error("Failed to send files:", error);
        alert("Có lỗi xảy ra khi gửi file.");
    } finally {
        setIsUploading(false);
    }
  };

  const handleSendAll = async () => {
    if ((!inputValue.trim() && selectedFiles.length === 0) || isSending || isUploading || !otherParticipant) return;
    if (selectedFiles.length > 0) await handleSendFile();
    if (inputValue.trim()) await handleSendMessage();
    
    // Refocus
    if (textareaRef.current) textareaRef.current.focus();
  };

  // 7. File Selection Handlers
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate size (100MB)
    const invalidFiles = files.filter(f => f.size > 100 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      alert("File quá lớn (>100MB)");
      return;
    }

    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);

    // Previews
    files.forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
           setFilePreviews(prev => new Map(prev).set(file.name, e.target?.result as string));
        };
        reader.readAsDataURL(file);
      }
    });

    e.target.value = '';
  }, [selectedFiles]);

  const handleClearFile = useCallback((fileName?: string) => {
    if (fileName) {
        setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
        setFilePreviews(prev => {
            const newMap = new Map(prev);
            newMap.delete(fileName);
            return newMap;
        });
    } else {
        setSelectedFiles([]);
        setFilePreviews(new Map());
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    
    if (imageFiles.length > 0) {
      e.preventDefault();
      const event = { target: { files: imageFiles } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(event, true);
    }
  }, [handleFileSelect]);

  // 8. Message Actions (Delete, Edit, React, Download)
  const handleDeleteMessage = useCallback(async (messageId: string) => {
      try { await socketManager.deleteMessage(messageId); }
      catch (e) { console.error(e); }
  }, []);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
      try { await socketManager.addReaction(messageId, emoji); }
      catch (e) { console.error(e); }
  }, []);

  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
     try { await socketManager.editMessage(messageId, content); }
     catch (e) { console.error(e); }
  }, []);

  const handleDownloadAttachment = useCallback(async (attachmentId: string, fileName: string) => {
    try {
        const token = Cookies.get("accessToken");
        const downloadUrl = `${config.apiUrl}/attachments/${attachmentId}/download`;
        const response = await fetch(downloadUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Download failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed download", error);
    }
  }, []);

  // 9. Calls
  const handleVideoCall = async () => {
    if (!otherParticipant) return;
    try {
        const { iceServers: turnServers } = await callsApi.getIceServers();
        const response = await socketManager.initiateCall(conversationId, otherParticipant.id, "video") as { callId: string; iceServers?: RTCIceServer[] };
        initiateCall(response.callId, otherParticipant.id, otherParticipant.display_name || otherParticipant.username, otherParticipant.avatar_url, "video");
        await initializePeerConnection(response.iceServers || turnServers);
        const offer = await createOffer();
        socketManager.sendOffer(response.callId, otherParticipant.id, offer);
    } catch (e) { console.error(e); alert("Failed to call"); }
  };

  const handleAudioCall = async () => {
    if (!otherParticipant) return;
    try {
        const { iceServers: turnServers } = await callsApi.getIceServers();
        const response = await socketManager.initiateCall(conversationId, otherParticipant.id, "audio") as { callId: string; iceServers?: RTCIceServer[] };
        initiateCall(response.callId, otherParticipant.id, otherParticipant.display_name || otherParticipant.username, otherParticipant.avatar_url, "audio");
        await initializePeerConnection(response.iceServers || turnServers);
        const offer = await createOffer();
        socketManager.sendOffer(response.callId, otherParticipant.id, offer);
    } catch (e) { console.error(e); alert("Failed to call"); }
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
      style={{ height: isMobile ? `${viewportHeight}px` : '100%' }}
    >
      <ChatHeader
        otherParticipant={otherParticipant}
        isOtherTyping={isOtherTyping}
        isMobile={isMobile}
        onBack={onBack}
        onVideoCall={handleVideoCall}
        onAudioCall={handleAudioCall}
      />

      <MessageList
        messages={conversationMessages}
        isLoading={isLoadingMessages}
        onImageClick={(url, name) => setSelectedImage({ url, fileName: name })}
        onDownload={handleDownloadAttachment}
        onReaction={handleReaction}
        onDelete={handleDeleteMessage}
        onEdit={(id, content) => {
            // Very simple prompt for now, could be improved with modal
            const newContent = prompt("Chỉnh sửa tin nhắn:", content);
            if (newContent && newContent !== content) handleEditMessage(id, newContent);
        }}
        onReply={(msg) => setReplyToMessage(msg)}
        isOtherTyping={isOtherTyping}
        otherParticipant={otherParticipant}
        isMobile={isMobile}
        keyboardHeight={keyboardHeight}
        isInputFocused={isInputFocused}
      />

      <ChatInput
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSend={handleSendAll}
        isSending={isSending}
        isUploading={isUploading}
        onFileSelect={handleFileSelect}
        fileInputRef={fileInputRef}
        imageInputRef={imageInputRef}
        showStickerPicker={showStickerPicker}
        setShowStickerPicker={setShowStickerPicker}
        textareaRef={textareaRef}
        isMobile={isMobile}
        isInputFocused={isInputFocused}
        selectedFiles={selectedFiles}
        filePreviews={filePreviews}
        onClearFile={handleClearFile}
        handlePaste={handlePaste}
        handleInputChange={handleInputChange}
      />

      <Suspense fallback={null}>
        {selectedImage && (
            <ImageModal
                imageUrl={selectedImage.url}
                fileName={selectedImage.fileName}
                onClose={() => setSelectedImage(null)}
            />
        )}
      </Suspense>

      {/* Minimized Calls */}
      {currentCall && isMinimized && currentCall.callType === "video" && (
        <MinimizedVideoCall
          remoteStream={remoteStream}
          localStream={localStream}
          recipientName={currentCall.recipientName}
          onMaximize={toggleMinimize}
          onEndCall={endCall}
        />
      )}
      {currentCall && isMinimized && currentCall.callType === "audio" && (
        <MinimizedAudioCall
          recipientName={currentCall.recipientName}
          onMaximize={toggleMinimize}
          onEndCall={endCall}
        />
      )}
    </div>
  );
}
