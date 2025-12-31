"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useConversationsStore } from "@/stores/conversationsStore";
import { conversationsApi, usersApi, User } from "@/lib/api";
import {
  Search,
  Settings,
  EyeOff,
  MessageSquare,
  Phone,
  Users,
  User as UserIcon,
  X,
  Loader2,
  PenSquare,
  LogOut,
} from "lucide-react";
import { ConversationItem } from "./ConversationItem";

interface SidebarProps {
  onConversationSelect: () => void;
}

export function Sidebar({ onConversationSelect }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const { conversations, activeConversationId, setActiveConversation, addConversation } = useConversationsStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"messages" | "calls" | "contacts" | "profile">("messages");
  const [contacts, setContacts] = useState<User[]>([]);
  const [isStartingChat, setIsStartingChat] = useState(false);

  // Load contacts on mount
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const data = await usersApi.getContacts();
        setContacts(data.contacts || []);
      } catch (error) {
        console.error("Failed to load contacts:", error);
      }
    };
    loadContacts();
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await usersApi.search(query);
      // Filter out current user from results
      setSearchResults(data.users.filter(u => u.id !== user?.id));
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = async (targetUser: User) => {
    if (isStartingChat) return;
    setIsStartingChat(true);
    try {
      const conversation = await conversationsApi.create(targetUser.id);
      addConversation(conversation);
      setActiveConversation(conversation.id);
      setSearchQuery("");
      setSearchResults([]);
      onConversationSelect();
    } catch (error) {
      console.error("Failed to start chat:", error);
      alert("Không thể bắt đầu cuộc trò chuyện. Vui lòng thử lại.");
    } finally {
      setIsStartingChat(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  // Get online users from conversations participants
  const onlineUsers = conversations
    .flatMap(conv => conv.participants)
    .filter(p => p.user_id !== user?.id && p.user?.is_online)
    .map(p => p.user)
    .filter((u, i, arr) => arr.findIndex(x => x?.id === u?.id) === i) // unique
    .slice(0, 6);

  return (
    <div className="flex flex-col w-full h-full bg-[#0b141a] overflow-hidden relative">
      {/* 1. Header Section */}
      <div className="p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[#202c33] overflow-hidden">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-sm">
                    {user?.display_name?.[0] || user?.username?.[0] || "?"}
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0b141a] rounded-full" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Đoạn chat</h1>
              <p className="text-xs text-[#8e9196]">{user?.display_name || user?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLogout}
              className="p-2.5 bg-[#202c33] rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors text-[#8e9196]"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
            <button className="p-2.5 bg-[#202c33] rounded-full hover:bg-[#2a3942] transition-colors">
              <Settings size={18} className="text-[#8e9196]" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center bg-[#202c33] rounded-2xl px-3 py-2.5">
          <Search size={18} className="text-[#8e9196] mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Tìm kiếm người dùng..."
            className="bg-transparent border-none outline-none text-white text-[15px] w-full placeholder:text-[#8e9196]"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchQuery && (
            <button onClick={clearSearch} className="p-1 hover:bg-[#374248] rounded-full transition-colors">
              <X size={16} className="text-[#8e9196]" />
            </button>
          )}
          {isSearching && <Loader2 size={16} className="text-[#0084ff] animate-spin ml-2" />}
        </div>
      </div>

      {/* 2. Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Search Results */}
        {searchQuery && (
          <div className="px-2">
            <p className="px-2 text-[13px] font-bold text-[#8e9196] uppercase mb-2">Kết quả tìm kiếm</p>
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="text-[#0084ff] animate-spin" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    disabled={isStartingChat}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#202c33] transition-colors disabled:opacity-50"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold">
                            {u.display_name?.[0] || u.username?.[0]}
                          </div>
                        )}
                      </div>
                      {u.is_online && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#0b141a] rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-semibold text-white truncate">{u.display_name || u.username}</p>
                      <p className="text-sm text-[#8e9196] truncate">@{u.username}</p>
                    </div>
                    {isStartingChat ? (
                      <Loader2 size={20} className="text-[#0084ff] animate-spin" />
                    ) : (
                      <MessageSquare size={20} className="text-[#0084ff]" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search size={32} className="text-[#8e9196] mb-2" />
                <p className="text-[#8e9196]">Không tìm thấy người dùng</p>
                <p className="text-xs text-[#8e9196] mt-1">Thử tìm với tên khác</p>
              </div>
            )}
          </div>
        )}

        {/* ĐANG HOẠT ĐỘNG - Only show when not searching */}
        {!searchQuery && onlineUsers.length > 0 && (
          <div className="py-2">
            <p className="px-4 text-[13px] font-bold text-[#8e9196] uppercase mb-3">Đang hoạt động</p>
            <div className="flex gap-4 overflow-x-auto px-4 no-scrollbar">
              {onlineUsers.map((u) => u && (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#222d34]">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                          {u.display_name?.[0] || u.username?.[0]}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#0b141a] rounded-full" />
                  </div>
                  <span className="text-[12px] text-white font-medium truncate max-w-[60px]">
                    {u.display_name?.split(' ')[0] || u.username}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GẦN ĐÂY - Conversations List */}
        {!searchQuery && (
          <div className="mt-4">
            <p className="px-4 text-[13px] font-bold text-[#8e9196] uppercase mb-2">
              Gần đây {conversations.length > 0 && `(${conversations.length})`}
            </p>
            <div className="px-2 space-y-0.5">
              {conversations.length > 0 ? (
                conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                    onClick={() => {
                      setActiveConversation(conv.id);
                      onConversationSelect();
                    }}
                    currentUserId={user?.id || ""}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-16 h-16 bg-[#202c33] rounded-full flex items-center justify-center mb-4">
                    <MessageSquare size={32} className="text-[#8e9196]" />
                  </div>
                  <p className="text-white font-medium">Chưa có cuộc trò chuyện nào</p>
                  <p className="text-[13px] text-[#8e9196] mt-1">Tìm kiếm bạn bè để bắt đầu chat</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) - New Chat */}
      <button 
        onClick={() => document.querySelector<HTMLInputElement>('input[placeholder*="Tìm kiếm"]')?.focus()}
        className="absolute bottom-24 right-4 w-14 h-14 bg-[#0084ff] rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-[#0073e6] transition-all active:scale-95 z-30"
        title="Bắt đầu cuộc trò chuyện mới"
      >
        <PenSquare className="text-white" size={24} />
      </button>

      {/* 3. Bottom Navigation */}
      <div className="flex-shrink-0 border-t border-[#222d34] bg-[#0b141a] px-2 py-3">
        <div className="flex items-center justify-around">
          <button 
            onClick={() => setActiveTab("messages")} 
            className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === "messages" ? "text-[#0084ff]" : "text-[#8e9196] hover:text-white"}`}
          >
            <MessageSquare size={24} className={activeTab === "messages" ? "fill-current" : ""} />
            <span className="text-[10px] font-bold">Tin nhắn</span>
          </button>
          <button 
            onClick={() => setActiveTab("calls")} 
            className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === "calls" ? "text-[#0084ff]" : "text-[#8e9196] hover:text-white"}`}
          >
            <Phone size={24} />
            <span className="text-[10px] font-bold">Cuộc gọi</span>
          </button>
          <button 
            onClick={() => setActiveTab("contacts")} 
            className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === "contacts" ? "text-[#0084ff]" : "text-[#8e9196] hover:text-white"}`}
          >
            <Users size={24} />
            <span className="text-[10px] font-bold">Danh bạ</span>
          </button>
          <button 
            onClick={() => setActiveTab("profile")} 
            className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === "profile" ? "text-[#0084ff]" : "text-[#8e9196] hover:text-white"}`}
          >
            <UserIcon size={24} />
            <span className="text-[10px] font-bold">Cá nhân</span>
          </button>
        </div>
      </div>
    </div>
  );
}
