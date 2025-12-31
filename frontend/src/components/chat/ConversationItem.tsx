"use client";

import { Conversation } from "@/lib/api";
import { Check, CheckCheck } from "lucide-react";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  currentUserId: string;
}

export function ConversationItem({
  conversation,
  isActive,
  onClick,
  currentUserId,
}: ConversationItemProps) {
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

  return (
    <div
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer transition-all ${
        isActive ? "bg-[#202c33]" : "hover:bg-[#1a232e]"
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-[56px] h-[56px] rounded-full overflow-hidden border border-[#222d34]">
          <img src={avatarUrl || "https://i.pravatar.cc/150"} alt="" className="w-full h-full object-cover" />
        </div>
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#22c55e] border-[3px] border-[#0b141a] rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-white text-[16px] truncate">{displayName}</h3>
          <span className={`text-[12px] ${conversation.unread_count > 0 ? "text-[#0084ff] font-bold" : "text-[#8e9196]"}`}>
            10:30 AM
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-[14px] truncate flex-1 ${conversation.unread_count > 0 ? "text-white font-bold" : "text-[#8e9196]"}`}>
            {isSentByMe ? "Bạn: " : ""}{lastMessage?.content || "Bắt đầu trò chuyện..."}
          </p>
          <div className="ml-2 flex-shrink-0">
            {conversation.unread_count > 0 ? (
              <div className="w-5 h-5 bg-[#0084ff] text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                {conversation.unread_count}
              </div>
            ) : isSentByMe ? (
              <CheckCheck size={14} className="text-[#8e9196]" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
