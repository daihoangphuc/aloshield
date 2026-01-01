"use client";

import { Conversation } from "@/lib/api";
import { Check, CheckCheck, MoreVertical, Trash2, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  currentUserId: string;
  onDelete?: (conversationId: string) => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onClick,
  currentUserId,
  onDelete,
}: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const otherParticipant = conversation.participants.find(
    (p) => p.user_id !== currentUserId
  )?.user;

  const displayName =
    conversation.type === "direct"
      ? otherParticipant?.display_name || otherParticipant?.username || "Unknown"
      : conversation.name || "Nhóm";

  const avatarUrl =
    conversation.type === "direct"
      ? otherParticipant?.avatar_url
      : conversation.avatar_url;

  const isOnline = otherParticipant?.is_online;
  const lastMessage = conversation.last_message;
  const isSentByMe = lastMessage?.sender_id === currentUserId;
  const isRead = lastMessage?.status === "read";
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete?.(conversation.id);
  };

  // Format time
  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return "Hôm qua";
    } else if (days < 7) {
      return date.toLocaleDateString("vi-VN", { weekday: "short" });
    } else {
      return date.toLocaleDateString("vi-VN", { day: "numeric", month: "short" });
    }
  };

  // Check if there are unread messages
  const hasUnread = conversation.unread_count > 0;

  return (
    <div
      onClick={onClick}
      className={`w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl md:rounded-3xl cursor-pointer transition-all duration-300 group relative z-0 ${
        isActive 
          ? "bg-[var(--primary)]/15 border border-[var(--primary)]/30 shadow-xl shadow-[var(--primary)]/10" 
          : hasUnread
            ? "bg-[var(--primary)]/8 border border-[var(--primary)]/20 hover:bg-[var(--primary)]/12"
            : "hover:bg-white/5 border border-transparent"
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden p-[2px] ${
          isActive 
            ? "avatar-ring" 
            : "bg-[var(--border)]"
        }`}>
          <div className="w-full h-full rounded-full bg-[var(--sidebar-bg)] overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-black text-lg md:text-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                {displayName[0]}
              </div>
            )}
          </div>
        </div>
        {isOnline && (
          <div className="online-indicator absolute bottom-0.5 right-0.5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <h3 className={`text-[14px] md:text-[15px] truncate tracking-tight transition-colors max-w-[140px] sm:max-w-[180px] md:max-w-none ${
            isActive ? "text-white font-bold" : hasUnread ? "text-white font-bold" : "text-white/90 font-semibold group-hover:text-white"
          }`}>
            {displayName}
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
              hasUnread ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
            }`}>
              {formatTime(lastMessage?.created_at || conversation.updated_at)}
            </span>
            {/* Menu button */}
            <div ref={menuRef} className="relative z-[90]">
              <button
                onClick={handleMenuClick}
                className={`p-1 md:p-1.5 rounded-lg hover:bg-white/10 transition-all ${
                  showMenu ? "bg-white/10" : ""
                }`}
              >
                <MoreVertical size={14} className="text-[var(--text-muted)]" />
              </button>
              
              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-[90] overflow-visible animate-in">
                  <div className="overflow-hidden rounded-xl">
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                    >
                      <Trash2 size={14} />
                      Xóa hội thoại
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <p className={`text-[12px] md:text-[13px] truncate flex-1 ${
            hasUnread ? "text-white font-semibold" : "text-[var(--text-muted)] font-medium"
          }`}>
            {isSentByMe && (
              <span className="text-[var(--primary)]/90 font-bold mr-1">Bạn:</span>
            )}
            {lastMessage?.content || lastMessage?.encrypted_content || "Bắt đầu trò chuyện mới..."}
          </p>
          <div className="flex-shrink-0">
            {hasUnread ? (
              <div className="min-w-[20px] h-[20px] bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white text-[10px] font-black rounded-full flex items-center justify-center px-1.5 shadow-lg shadow-[var(--primary)]/30 animate-pulse">
                {conversation.unread_count}
              </div>
            ) : isSentByMe ? (
              isRead ? (
                <CheckCheck size={14} className="text-[var(--primary)]" />
              ) : (
                <Check size={14} className="text-[var(--text-muted)]" />
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
