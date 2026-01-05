import { memo, useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  MoreVertical,
  Smile,
  Check,
  CheckCheck,
  Play,
  FileText,
  Download,
  Image as ImageIcon,
  Loader2,
  Video,
  Pencil,
  Trash2,
  Reply
} from "lucide-react";
import { createPortal } from "react-dom";
import Cookies from "js-cookie";
import { config } from "@/lib/config";
import { Message } from "@/lib/api";

// --- Moving Utility Component Here for now to avoid circular dependency issues if I modify ChatWindow too much ---
const ImageMessage = memo(function ImageMessage({
  attachment,
  isMe,
  onImageClick
}: {
  attachment: {
      id: string;
      file_name: string;
      file_size?: number;
  };
  isMe: boolean;
  onImageClick: (url: string, fileName: string) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const downloadUrl = useMemo(
    () => `${config.apiUrl}/attachments/${attachment.id}/download`,
    [attachment.id]
  );

  const fileSizeMB = useMemo(
    () => attachment.file_size ? (attachment.file_size / 1024 / 1024).toFixed(1) : null,
    [attachment.file_size]
  );

  useEffect(() => {
    let blobUrl: string | null = null;

    const loadImage = async () => {
      try {
        const token = Cookies.get('accessToken');
        if (!token) {
          setImageError(true);
          setIsLoading(false);
          return;
        }

        const response = await fetch(downloadUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include',
        });

        if (!response.ok) throw new Error(`Failed to load image: ${response.status}`);

        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        setImageUrl(blobUrl);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load image:', error);
        setImageError(true);
        setIsLoading(false);
      }
    };

    loadImage();
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [downloadUrl, attachment.id]);

  const handleImageClick = useCallback(() => {
    if (!imageError && imageUrl) {
      onImageClick(downloadUrl, attachment.file_name);
    }
  }, [imageError, imageUrl, downloadUrl, attachment.file_name, onImageClick]);

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
      {fileSizeMB && (
        <div className="px-3 py-2 flex items-center gap-2 border-t border-[var(--border)] relative z-0">
          <p className="text-xs text-[var(--text-muted)] truncate flex-1">{attachment.file_name}</p>
          <span className="text-[10px] text-[var(--text-muted)]">
            {fileSizeMB} MB
          </span>
        </div>
      )}
    </div>
  );
}, (prev, next) => prev.attachment.id === next.attachment.id && prev.isMe === next.isMe);


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

interface MessageItemProps {
  msg: Message;
  isMe: boolean;
  showDate: boolean;
  onImageClick: (url: string, fileName: string) => void;
  onDownload: (id: string, name: string) => void;
  onReaction: (id: string, emoji: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onReply: (msg: Message) => void;
}

export const MessageItem = memo(function MessageItem({
  msg,
  isMe,
  showDate,
  onImageClick,
  onDownload,
  onReaction,
  onDelete,
  onEdit,
  onReply
}: MessageItemProps) {
  const isDeleted = !!msg.deleted_at;
  const isEdited = !!msg.edited_at;
  const reactions = (msg as { reactions?: Array<{ emoji: string; count: number }> }).reactions || [];

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeMenu, setActiveMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{top: number, left?: number, right?: number} | null>(null);

  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const quickEmojis = useMemo(() => ["❤️", "😂", "😮", "😢", "😡", "👍"], []);

  const canEdit = useMemo(() => {
    const created = new Date(msg.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
    return diffMinutes <= 15;
  }, [msg.created_at]);

  return (
    <div className="stagger-item">
       {/* Date separator */}
       {showDate && (
        <div className="flex justify-center my-4 md:my-6">
          <span className="text-[10px] md:text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--chat-bg)] px-3 md:px-4 py-1 rounded-full border border-[var(--border)]">
            {formatDate(msg.created_at)}
          </span>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`flex ${isMe ? "justify-end" : "justify-start"} group relative mb-2 px-1`}
        onClick={() => {
          // Optional: Add tap to toggle timestamp or actions logic here if strict 'group-active' isn't enough
        }}
      >
        <div className={`flex items-end gap-1.5 md:gap-2 max-w-[85%] md:max-w-[70%] ${isMe ? "flex-row-reverse" : ""}`}>

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

          <div className="flex flex-col relative group">
             {/* Message Actions (Hover or Tap) */}
             {!isDeleted && !msg.id.startsWith("temp-") && (
                <div
                  className={`absolute top-0 ${isMe ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"}
                  opacity-0 group-hover:opacity-100 group-active:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 z-10
                  md:opacity-0 md:group-hover:opacity-100`}
                  // On mobile, tapping the message bubble (which is the parent group) triggers active state
                  // Alternatively, we can make this always visible on mobile if needed, or toggle on tap.
                  // For now, using group-active covers the "tap and hold" or "tap" interaction briefly.
                  // To make it persistent on tap, we would need local state 'isSelected' on the item.
                >
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 md:p-1.5 bg-black/20 md:bg-transparent hover:bg-white/10 rounded-full transition-colors cursor-pointer backdrop-blur-sm md:backdrop-blur-none"
                    aria-label="React"
                  >
                    <Smile size={18} className="text-[var(--text-muted)] md:w-4 md:h-4" />
                  </button>

                  <button
                    ref={menuButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (menuButtonRef.current) {
                        const rect = menuButtonRef.current.getBoundingClientRect();
                        if (isMe) {
                          setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                        } else {
                          setMenuPos({ top: rect.bottom + 4, left: rect.left });
                        }
                        setActiveMenu(!activeMenu);
                      }
                    }}
                    className="p-2 md:p-1.5 bg-black/20 md:bg-transparent hover:bg-white/10 rounded-full transition-colors cursor-pointer backdrop-blur-sm md:backdrop-blur-none"
                    aria-label="More options"
                  >
                    <MoreVertical size={18} className="text-[var(--text-muted)] md:w-4 md:h-4" />
                  </button>
                </div>
              )}

             {/* Emoji Picker */}
             {showEmojiPicker && (
                <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-12 glass-card rounded-full px-2 py-1 flex items-center gap-1 shadow-lg z-[80]`}>
                  {quickEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReaction(msg.id, emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="p-1 hover:bg-white/10 rounded-full transition-colors text-lg hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

             {/* Context Menu Portal */}
             {activeMenu && menuPos && createPortal(
                <>
                  <div className="fixed inset-0 z-[99]" onClick={() => setActiveMenu(false)} />
                  <div
                    className="fixed glass-card rounded-xl shadow-2xl z-[100] min-w-[140px] pointer-events-auto"
                    style={{
                      top: `${menuPos.top}px`,
                      ...(menuPos.left !== undefined ? { left: `${menuPos.left}px` } : {}),
                      ...(menuPos.right !== undefined ? { right: `${menuPos.right}px` } : {}),
                    }}
                  >
                    <div className="overflow-hidden rounded-xl">
                      {!isMe && (
                        <button
                          onClick={() => { onReply(msg); setActiveMenu(false); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Reply size={14} /> Trả lời
                        </button>
                      )}
                      {isMe && canEdit && (
                         <button
                         onClick={() => { onEdit(msg.id, msg.content || msg.encrypted_content || ""); setActiveMenu(false); }}
                         className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer transition-colors"
                       >
                         <Pencil size={14} /> Chỉnh sửa
                       </button>
                      )}
                      {isMe && (
                        <button
                          onClick={() => { onDelete(msg.id); setActiveMenu(false); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-[var(--danger)] hover:bg-white/10 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Trash2 size={14} /> Thu hồi
                        </button>
                      )}
                       <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content || msg.encrypted_content || "");
                          setActiveMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        Sao chép
                      </button>
                    </div>
                  </div>
                </>,
                document.body
             )}

            {/* Message Content */}
            {isDeleted ? (
               <div className="px-4 py-2.5 text-[15px] italic text-[var(--text-muted)] bg-[var(--card)] rounded-2xl border border-[var(--border)]">
               Tin nhắn đã bị thu hồi
             </div>
            ) : msg.content_type === "text" ? (
              <div
                className={`px-4 py-2.5 text-[15px] leading-relaxed transition-all duration-200 relative ${
                  isMe ? "bubble-sent" : "bubble-received"
                }`}
              >
                {msg.content || msg.encrypted_content}
              </div>
            ) : msg.content_type === "image" && msg.attachments?.[0] ? (
              <ImageMessage
                attachment={msg.attachments[0]}
                isMe={isMe}
                onImageClick={onImageClick}
              />
            ) : msg.content_type === "video" && msg.attachments?.[0] ? (
               <div
               className={`rounded-2xl overflow-hidden cursor-pointer group/vid max-w-[300px] ${
                 isMe ? "bg-[var(--primary)]/10" : "bg-[var(--card)]"
               } border border-[var(--border)]`}
               onClick={() => onDownload(msg.attachments![0].id, msg.attachments![0].file_name)}
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
               onClick={() => onDownload(msg.attachments![0].id, msg.attachments![0].file_name)}
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
            ) : (
               <div
               className={`px-4 py-2.5 text-[15px] leading-relaxed transition-all duration-200 ${
                 isMe ? "bubble-sent" : "bubble-received"
               }`}
             >
               {msg.content || msg.encrypted_content || "..."}
             </div>
            )}

            {/* Reactions Display */}
            {reactions.length > 0 && (
              <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                {reactions.map((r) => (
                  <span
                    key={r.emoji}
                    className="bg-[var(--card)] px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1 border border-[var(--border)]"
                  >
                    {r.emoji} <span className="text-[var(--text-muted)]">{r.count}</span>
                  </span>
                ))}
              </div>
            )}

             {/* Time and Status */}
             <div className={`flex items-center gap-1 mt-1 text-[10px] text-[var(--text-muted)] ${isMe ? "justify-end" : "justify-start"}`}>
                <span>{formatTime(msg.created_at)}</span>
                {isEdited && !isDeleted && <span>(đã chỉnh sửa)</span>}
                {isMe && !isDeleted && (
                  msg.id.startsWith("temp-") && !msg.status ? (
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
});
