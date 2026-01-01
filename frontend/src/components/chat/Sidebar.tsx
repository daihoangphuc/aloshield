"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useConversationsStore } from "@/stores/conversationsStore";
import { conversationsApi, usersApi, User, Conversation } from "@/lib/api";
import {
  Search,
  MessageSquare,
  Phone,
  Users,
  User as UserIcon,
  X,
  Loader2,
  LogOut,
  Undo2,
} from "lucide-react";
import { ConversationItem } from "./ConversationItem";

interface SidebarProps {
  onConversationSelect: () => void;
}

interface DeletedConversation {
  conversation: Conversation;
  timeoutId: NodeJS.Timeout;
}

export function Sidebar({ onConversationSelect }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const { conversations, activeConversationId, setActiveConversation, addConversation, setConversations } = useConversationsStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"messages" | "calls" | "contacts" | "profile">("messages");
  const [contacts, setContacts] = useState<User[]>([]);
  const [isStartingChat, setIsStartingChat] = useState(false);
  
  // Undo delete state
  const [deletedConversation, setDeletedConversation] = useState<DeletedConversation | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(5);

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

  // Handle delete conversation with undo
  const handleDeleteConversation = useCallback((conversationId: string) => {
    const convToDelete = conversations.find(c => c.id === conversationId);
    if (!convToDelete) return;

    // Clear previous undo if exists
    if (deletedConversation) {
      clearTimeout(deletedConversation.timeoutId);
      // Actually delete the previous one since user started new delete
      conversationsApi.delete(deletedConversation.conversation.id).catch(console.error);
    }

    // Remove from UI immediately
    setConversations(conversations.filter(c => c.id !== conversationId));
    
    // If this was the active conversation, clear it
    if (activeConversationId === conversationId) {
      setActiveConversation(null);
    }

    // Start countdown
    setUndoCountdown(5);
    
    // Set timeout to actually delete
    const timeoutId = setTimeout(async () => {
      try {
        await conversationsApi.delete(conversationId);
        console.log("Conversation deleted:", conversationId);
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
      setDeletedConversation(null);
    }, 5000);

    setDeletedConversation({ conversation: convToDelete, timeoutId });
  }, [conversations, deletedConversation, activeConversationId, setConversations, setActiveConversation]);

  // Handle undo delete
  const handleUndoDelete = useCallback(() => {
    if (!deletedConversation) return;
    
    // Clear timeout
    clearTimeout(deletedConversation.timeoutId);
    
    // Restore conversation
    addConversation(deletedConversation.conversation);
    
    // Clear state
    setDeletedConversation(null);
    setUndoCountdown(5);
  }, [deletedConversation, addConversation]);

  // Countdown effect
  useEffect(() => {
    if (!deletedConversation) return;
    
    const interval = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [deletedConversation]);

  // Get online users from conversations participants
  const onlineUsers = conversations
    .flatMap(conv => conv.participants)
    .filter(p => p.user_id !== user?.id && p.user?.is_online)
    .map(p => p.user)
    .filter((u, i, arr) => arr.findIndex(x => x?.id === u?.id) === i) // unique
    .slice(0, 6);

  return (
    <div className="flex flex-col w-full h-full bg-[var(--sidebar-bg)] overflow-hidden relative border-r border-[var(--border)]">
      {/* 1. Header Section - Safe area for mobile */}
      <div 
        className="p-4 md:p-5 flex-shrink-0 space-y-4 md:space-y-5"
        style={{
          paddingTop: 'max(1rem, calc(1rem + env(safe-area-inset-top, 0px)))',
          paddingLeft: 'calc(1rem + env(safe-area-inset-left, 0px))',
          paddingRight: 'calc(1rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative group cursor-pointer flex-shrink-0">
              <div className="avatar-ring w-10 h-10 md:w-12 md:h-12 transition-transform duration-300 group-hover:scale-105">
                <div className="w-full h-full rounded-full bg-[var(--sidebar-bg)] overflow-hidden">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-black text-base md:text-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                      {user?.display_name?.[0] || user?.username?.[0] || "?"}
                    </div>
                  )}
                </div>
              </div>
              <div className="online-indicator absolute bottom-0 right-0" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-black text-white tracking-tight truncate">Đoạn chat</h1>
              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                  <div className="absolute w-3 h-3 rounded-full bg-[var(--success)]/40 animate-ping" />
                </div>
                <p className="text-[9px] md:text-[10px] font-bold text-[var(--success)] uppercase tracking-widest">Trực tuyến</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <button 
              onClick={handleLogout}
              className="p-2 md:p-2.5 bg-[var(--danger)]/10 rounded-xl hover:bg-[var(--danger)]/20 transition-all text-[var(--danger)]/70 hover:text-[var(--danger)]"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-all group-focus-within:scale-110">
            <Search size={16} className="text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm bạn bè..."
            className="input-field !pl-12 pr-10 py-3 text-sm bg-black/40 border-white/5 group-focus-within:bg-black/60 transition-all duration-300 rounded-[18px]"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchQuery && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg transition-colors active:scale-90">
              <X size={14} className="text-[var(--text-muted)] hover:text-white" />
            </button>
          )}
          {isSearching && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <Loader2 size={14} className="text-[var(--primary)] animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* 2. Scrollable Content */}
      <div 
        className="flex-1 overflow-y-auto no-scrollbar"
        style={{
          paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {/* Feature Under Development */}
        {activeTab !== "messages" && (
          <div className="flex flex-col items-center justify-center h-full px-6 py-20 text-center">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-[var(--border)]">
              <Loader2 size={36} className="text-[var(--primary)] animate-spin" />
            </div>
            <h3 className="text-white font-black text-xl md:text-2xl mb-2">Tính năng đang phát triển</h3>
            <p className="text-[13px] md:text-[14px] font-medium text-[var(--text-muted)] leading-relaxed max-w-md">
              Tính năng này đang được chúng tôi phát triển và sẽ sớm có mặt trong phiên bản tương lai.
            </p>
          </div>
        )}

        {/* Messages Tab Content */}
        {activeTab === "messages" && (
          <>
            {/* Search Results */}
            {searchQuery && (
          <div className="px-3 animate-in">
            <p className="px-3 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4">Kết quả tìm kiếm</p>
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 size={32} className="text-[var(--primary)] animate-spin" />
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Đang tìm kiếm...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((u, index) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    disabled={isStartingChat}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all disabled:opacity-50 group stagger-item"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="avatar-ring w-12 h-12">
                        <div className="w-full h-full rounded-full bg-[var(--sidebar-bg)] flex items-center justify-center overflow-hidden">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-black text-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                              {u.display_name?.[0] || u.username?.[0]}
                            </div>
                          )}
                        </div>
                      </div>
                      {u.is_online && <div className="online-indicator absolute bottom-0 right-0" />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-bold text-white truncate group-hover:text-[var(--primary)] transition-colors">
                        {u.display_name || u.username}
                      </p>
                      <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">@{u.username}</p>
                    </div>
                    {isStartingChat ? (
                      <Loader2 size={20} className="text-[var(--primary)] animate-spin" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageSquare size={18} className="text-[var(--primary)]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4 border border-[var(--border)]">
                  <Search size={32} className="text-[var(--text-muted)]" />
                </div>
                <p className="text-white font-bold mb-1">Không tìm thấy ai</p>
                <p className="text-xs font-medium text-[var(--text-muted)]">Hãy thử tìm bằng tên người dùng chính xác hơn.</p>
              </div>
            )}
            </div>
            )}

            {/* Active Users - Horizontal Scroll */}
            {!searchQuery && onlineUsers.length > 0 && (
          <div className="py-4 border-b border-[var(--border)]">
            <p className="px-5 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4">Đang hoạt động</p>
            <div className="flex gap-5 overflow-x-auto px-5 no-scrollbar">
              {onlineUsers.map((u, index) => u && (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className="flex flex-col items-center gap-2.5 flex-shrink-0 group stagger-item"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative">
                    <div className="avatar-ring-online w-[64px] h-[64px] transition-transform group-hover:scale-105 shadow-xl shadow-[var(--success-glow)]">
                      <div className="w-full h-full rounded-full bg-[var(--sidebar-bg)] flex items-center justify-center overflow-hidden border-2 border-transparent">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-black text-xl bg-gradient-to-br from-[var(--success)] to-[var(--primary)]">
                            {u.display_name?.[0] || u.username?.[0]}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="online-indicator-lg absolute bottom-0.5 right-0.5" />
                  </div>
                  <span className="text-[11px] font-bold text-white truncate max-w-[64px] tracking-tight">
                    {u.display_name?.split(' ')[0] || u.username}
                  </span>
                </button>
              ))}
            </div>
          </div>
            )}

            {/* Recent Conversations */}
            {!searchQuery && (
          <div className="mt-6">
            <div className="flex items-center justify-between px-5 mb-4">
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">
                Gần đây {conversations.length > 0 && `(${conversations.length})`}
              </p>
            </div>
            
            <div className="px-2 space-y-1">
              {conversations.length > 0 ? (
                conversations.map((conv, index) => (
                  <div key={conv.id} className="stagger-item" style={{ animationDelay: `${index * 30}ms` }}>
                    <ConversationItem
                      conversation={conv}
                      isActive={conv.id === activeConversationId}
                      onClick={() => {
                        setActiveConversation(conv.id);
                        onConversationSelect();
                      }}
                      currentUserId={user?.id || ""}
                      onDelete={handleDeleteConversation}
                    />
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-[var(--border)]">
                    <MessageSquare size={36} className="text-[var(--text-muted)]" />
                  </div>
                  <h3 className="text-white font-black mb-2">Bắt đầu trò chuyện</h3>
                  <p className="text-[13px] font-medium text-[var(--text-muted)] leading-relaxed">
                    Mọi tin nhắn của bạn sẽ được mã hóa an toàn tại đây.
                  </p>
                </div>
              )}
            </div>
          </div>
            )}
          </>
        )}
      </div>

      {/* Undo Delete Toast */}
      {deletedConversation && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[90%] z-[60] animate-in">
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xl border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--danger)]/10 flex items-center justify-center flex-shrink-0">
                <X size={18} className="text-[var(--danger)]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Đã xóa hội thoại</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Hoàn tác trong {undoCountdown}s
                </p>
              </div>
            </div>
            <button
              onClick={handleUndoDelete}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-bold rounded-xl transition-all"
            >
              <Undo2 size={16} />
              Hoàn tác
            </button>
          </div>
        </div>
      )}

      {/* 3. Bottom Navigation - Glassmorphism - Fixed with safe area */}
      <div 
        className="fixed bottom-0 left-0 right-0 flex justify-center z-50 md:relative md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:w-[90%]"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
        <div className="glass-card rounded-[24px] md:rounded-3xl px-2 py-1.5 md:py-2 flex items-center justify-between shadow-2xl border-white/10 w-[92%] md:w-full max-w-[600px]">
          {[
            { id: "messages", icon: MessageSquare, label: "Chat" },
            { id: "calls", icon: Phone, label: "Gọi" },
            { id: "contacts", icon: Users, label: "Bạn bè" },
            { id: "profile", icon: UserIcon, label: "Tôi" },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`relative flex flex-col items-center justify-center gap-1 h-12 md:h-14 w-14 md:w-16 rounded-xl md:rounded-2xl transition-all duration-300 ${
                activeTab === tab.id 
                  ? "text-white" 
                  : "text-[var(--text-muted)] hover:text-white hover:bg-white/5"
              }`}
            >
              {/* Active background */}
              {activeTab === tab.id && (
                <div className="absolute inset-0 bg-gradient-to-b from-[var(--primary)]/25 to-transparent rounded-xl md:rounded-2xl" />
              )}
              
              {/* Active indicator */}
              {activeTab === tab.id && (
                <div className="absolute -top-1 w-1 h-1 md:w-1.5 md:h-1.5 bg-[var(--primary)] rounded-full shadow-lg shadow-[var(--primary)]" />
              )}
              
              <tab.icon 
                size={activeTab === tab.id ? 22 : 20} 
                className={`relative z-10 transition-all duration-300 ${activeTab === tab.id ? "drop-shadow-[0_0_10px_var(--primary-glow)]" : ""}`} 
              />
              <span className="relative z-10 text-[8px] md:text-[9px] font-black uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
