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

  return (
    <div
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 group relative ${
        isActive 
          ? "bg-[var(--primary)]/10 border border-[var(--primary)]/20 shadow-lg shadow-[var(--primary)]/5" 
          : "hover:bg-white/5 border border-transparent"
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-14 h-14 rounded-2xl overflow-hidden p-[2px] ${
          isActive 
            ? "bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]" 
            : "bg-[var(--border)]"
        }`}>
          <div className="w-full h-full rounded-[14px] bg-[var(--sidebar-bg)] overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-black text-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                {displayName[0]}
              </div>
            )}
          </div>
        </div>
        {isOnline && (
          <div className="online-indicator absolute -bottom-0.5 -right-0.5 w-4 h-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`font-bold text-[15px] truncate tracking-tight transition-colors ${
            isActive ? "text-[var(--primary)]" : "text-white group-hover:text-[var(--primary)]"
          }`}>
            {displayName}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              conversation.unread_count > 0 ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
            }`}>
              {formatTime(lastMessage?.created_at || conversation.updated_at)}
            </span>
            {/* Menu button - luôn hiện */}
            <div ref={menuRef} className="relative">
              <button
                onClick={handleMenuClick}
                className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${
                  showMenu ? "bg-white/10" : ""
                }`}
              >
                <MoreVertical size={16} className="text-[var(--text-muted)]" />
              </button>
              
              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden animate-in">
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                  >
                    <Trash2 size={16} />
                    Xóa hội thoại
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-[13px] font-medium truncate flex-1 ${
            conversation.unread_count > 0 ? "text-white" : "text-[var(--text-muted)]"
          }`}>
            {isSentByMe && (
              <span className="text-[var(--primary)]/70 font-semibold mr-1">Bạn:</span>
            )}
            {lastMessage?.content || lastMessage?.encrypted_content || "Bắt đầu trò chuyện mới..."}
          </p>
          <div className="ml-2 flex-shrink-0">
            {conversation.unread_count > 0 ? (
              <div className="min-w-[20px] h-5 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white text-[10px] font-black rounded-full flex items-center justify-center px-1.5 shadow-lg shadow-[var(--primary)]/20">
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
