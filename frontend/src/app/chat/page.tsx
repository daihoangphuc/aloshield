"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useConversationsStore } from "@/stores/conversationsStore";
import { conversationsApi, authApi } from "@/lib/api";
import { socketManager } from "@/lib/socket";
import Cookies from "js-cookie";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { EmptyChat } from "@/components/chat/EmptyChat";
import { VideoCallWindow } from "@/components/call/VideoCallWindow";
import { IncomingCallModal } from "@/components/call/IncomingCallModal";
import { useCallStore } from "@/stores/callStore";
import { Loader2 } from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const { user, setUser, setLoading: setAuthLoading } = useAuthStore();
  const { activeConversationId, setConversations } = useConversationsStore();
  const { currentCall, incomingCall } = useCallStore();
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Add chat-page class to body for overflow control
  useEffect(() => {
    document.body.classList.add("chat-page");
    return () => {
      document.body.classList.remove("chat-page");
    };
  }, []);

  // Authentication Check & Load Data
  useEffect(() => {
    let mounted = true;
    
    const initializeApp = async () => {
      const token = Cookies.get("accessToken");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        // Get user data if not available
        let currentUser = user;
        if (!currentUser) {
          currentUser = await authApi.getMe();
          if (mounted) setUser(currentUser);
        }

        // Connect socket
        socketManager.connect();

        // Load conversations immediately
        const data = await conversationsApi.getAll();
        if (mounted) {
          setConversations(data.conversations || []);
          setIsInitialized(true);
          setIsInitializing(false);
        }
        
        setAuthLoading(false);
      } catch (error) {
        console.error("Failed to initialize:", error);
        if (mounted) router.push("/login");
      }
    };

    initializeApp();

    return () => {
      mounted = false;
      socketManager.disconnect();
    };
  }, []); // Run only once on mount

  // Handle Responsive
  useEffect(() => {
    const handleResize = () => {
      // Tăng breakpoint lên 1024px cho tablet/desktop trải nghiệm tốt hơn
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setShowSidebar(true);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync sidebar visibility with active conversation on mobile
  useEffect(() => {
    if (isMobile && activeConversationId) {
      // Chỉ tự động ẩn sidebar trên mobile thực thụ
      if (window.innerWidth < 768) {
        setShowSidebar(false);
      }
    }
  }, [activeConversationId, isMobile]);

  if (isInitializing || !isInitialized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[var(--background)]">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--blue-accent)] mb-4" />
        <p className="text-[var(--text-secondary)]">Đang chuẩn bị môi trường an toàn...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-[var(--background)] overflow-hidden">
      {/* Sidebar Container */}
      <aside 
        className={`${
          isMobile && !showSidebar ? "hidden" : "flex"
        } w-full md:w-[320px] lg:w-[380px] xl:w-[420px] flex-shrink-0 h-full border-r border-[var(--border)] z-20 bg-[var(--sidebar-bg)] transition-all duration-300`}
      >
        <Sidebar onConversationSelect={() => {
          if (window.innerWidth < 1024) setShowSidebar(false);
        }} />
      </aside>

      {/* Main Chat Area */}
      <main 
        className={`${
          isMobile && showSidebar ? "hidden" : "flex"
        } flex-1 h-full flex flex-col relative bg-[var(--chat-bg)]`}
      >
        {activeConversationId ? (
          <ChatWindow
            conversationId={activeConversationId}
            onBack={() => setShowSidebar(true)}
            isMobile={isMobile}
          />
        ) : (
          <EmptyChat />
        )}
      </main>

      {/* Video Call Overlay */}
      {currentCall && <VideoCallWindow />}
      
      {/* Incoming Call Modal */}
      {incomingCall && <IncomingCallModal />}
    </div>
  );
}
