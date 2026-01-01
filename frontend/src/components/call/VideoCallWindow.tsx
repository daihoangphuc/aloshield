"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCallStore } from "@/stores/callStore";
import { useConversationsStore } from "@/stores/conversationsStore";
import { conversationsApi } from "@/lib/api";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  UserPlus, 
  ChevronDown, 
  Lock,
  Volume2,
  MessageSquare
} from "lucide-react";

export function VideoCallWindow() {
  const router = useRouter();
  const { 
    currentCall, 
    localStream, 
    remoteStream, 
    isMuted, 
    isVideoOff,
    isMinimized,
    toggleMute,
    toggleVideo,
    toggleMinimize,
    endCall 
  } = useCallStore();
  const { conversations, setActiveConversation } = useConversationsStore();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null); // For audio calls
  const remoteVideoAudioRef = useRef<HTMLAudioElement>(null); // For video calls - separate audio element
  const [timer, setTimer] = useState("00:00");
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    console.log("🎥 Local stream updated:", localStream);
    if (localVideoRef.current && localStream) {
      console.log("🎥 Setting local video srcObject");
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.error("Error playing local video:", e));
    }
  }, [localStream]);

  useEffect(() => {
    console.log("🎥 Remote stream updated:", remoteStream);
    if (remoteStream) {
      // For video calls, use video element for video AND separate audio element for audio
      if (currentCall?.callType === "video") {
        if (remoteVideoRef.current) {
          console.log("🎥 Setting remote video srcObject");
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.muted = false; // ✅ Ensure video audio is not muted
          remoteVideoRef.current.play().catch(e => console.error("Error playing remote video:", e));
        }
        // ✅ Also use separate audio element for video calls to ensure audio plays
        if (remoteVideoAudioRef.current) {
          console.log("🔊 Setting remote video audio srcObject");
          remoteVideoAudioRef.current.srcObject = remoteStream;
          remoteVideoAudioRef.current.muted = false;
          remoteVideoAudioRef.current.volume = 1.0;
          remoteVideoAudioRef.current.play().catch(e => {
            console.error("Error playing remote video audio:", e);
            // Retry play if it fails (browser autoplay policy)
            setTimeout(() => {
              if (remoteVideoAudioRef.current) {
                remoteVideoAudioRef.current.play().catch(err => console.error("Retry video audio play failed:", err));
              }
            }, 100);
          });
        }
      }
      // For audio calls, use audio element
      if (currentCall?.callType === "audio" && remoteAudioRef.current) {
        console.log("🔊 Setting remote audio srcObject");
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.play().catch(e => {
          console.error("Error playing remote audio:", e);
          // Retry play if it fails (browser autoplay policy)
          setTimeout(() => {
            if (remoteAudioRef.current) {
              remoteAudioRef.current.play().catch(err => console.error("Retry play failed:", err));
            }
          }, 100);
        });
      }
    } else {
      // Clear audio elements when stream is removed
      if (remoteAudioRef.current && currentCall?.callType === "audio") {
        remoteAudioRef.current.srcObject = null;
      }
      if (remoteVideoAudioRef.current && currentCall?.callType === "video") {
        remoteVideoAudioRef.current.srcObject = null;
      }
    }
  }, [remoteStream, currentCall?.callType]);

  // Simple call timer simulation
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
      const secs = (elapsed % 60).toString().padStart(2, "0");
      setTimer(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!currentCall) return null;

  // Don't render full screen if minimized - minimized view is handled in ChatWindow
  if (isMinimized) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col animate-in">
      {/* Hidden audio element for audio calls */}
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        playsInline 
        muted={false}
        className="hidden" 
      />
      {/* Hidden audio element for video calls - separate audio track */}
      <audio 
        ref={remoteVideoAudioRef} 
        autoPlay 
        playsInline 
        muted={false}
        className="hidden" 
      />
      {/* REMOTE VIDEO (FULL SCREEN) - Click to toggle controls */}
      <div 
        className="absolute inset-0 overflow-hidden cursor-pointer"
        onClick={() => setShowControls(!showControls)}
      >
        {remoteStream && currentCall.callType === "video" ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-[var(--primary)]/10 rounded-full blur-[150px]" />
              <div className="absolute bottom-1/3 right-1/3 w-[300px] h-[300px] bg-[var(--accent)]/10 rounded-full blur-[120px]" />
            </div>
            
            <div className="relative">
              <div className="avatar-ring w-32 h-32 pulse-glow">
                <div className="w-full h-full rounded-full bg-[#1a1a1a] overflow-hidden">
                  {currentCall.recipientAvatar ? (
                    <img 
                      src={currentCall.recipientAvatar} 
                      className="w-full h-full object-cover" 
                      alt=""
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-black text-4xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                      {currentCall.recipientName?.[0] || "?"}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-black text-white mt-6">{currentCall.recipientName}</h2>
            <p className="text-[var(--text-muted)] mt-2 animate-pulse font-medium">Đang kết nối bảo mật...</p>
          </div>
        )}
      </div>

      {/* TOP HEADER */}
      <div 
        className={`relative flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button 
          onClick={async (e) => {
            e.stopPropagation();
            // Minimize the call and navigate to chat (same as chat button)
            toggleMinimize();
            
            // Find or create conversation with recipient
            if (currentCall?.recipientId) {
              // Find existing conversation
              const existingConv = conversations.find(conv => 
                conv.participants?.some(p => (p.user?.id || p.user_id) === currentCall.recipientId)
              );
              
              if (existingConv) {
                setActiveConversation(existingConv.id);
              } else {
                // Create new conversation
                try {
                  const newConv = await conversationsApi.create(currentCall.recipientId);
                  setActiveConversation(newConv.id);
                } catch (error) {
                  console.error("Failed to create conversation:", error);
                }
              }
            }
            
            // Navigate to chat page
            router.push("/chat");
          }}
          className="p-3 glass-card rounded-full hover:bg-white/10 transition-all"
          title="Quay về chat"
        >
          <ChevronDown className="text-white w-6 h-6" />
        </button>
        
        <div className="flex flex-col items-center">
          <h3 className="text-white font-bold text-lg">{currentCall.recipientName || "Đang gọi..."}</h3>
          <div className="flex items-center gap-2 mt-2 px-4 py-1.5 glass-card rounded-full">
            <Lock className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span className="text-white text-xs font-mono font-medium tracking-wider">{timer}</span>
            <span className="text-[var(--success)] text-xs font-bold">• Encrypted</span>
          </div>
        </div>

        <button className="p-3 glass-card rounded-full hover:bg-white/10 transition-all">
          <UserPlus className="text-white w-6 h-6" />
        </button>
      </div>

      {/* LOCAL VIDEO (FLOATING) - Only show for video calls, always visible */}
      {currentCall.callType === "video" && (
        <div 
          className="absolute top-24 right-6 w-32 h-48 md:w-40 md:h-60 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black animate-in"
          onClick={(e) => e.stopPropagation()}
        >
          {localStream && !isVideoOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[var(--card)]">
              <VideoOff className="text-white/20 w-10 h-10" />
            </div>
          )}
          {isMuted && (
            <div className="absolute bottom-2 right-2 p-1.5 bg-[var(--danger)] rounded-full">
              <MicOff className="text-white w-3 h-3" />
            </div>
          )}
        </div>
      )}

      {/* BOTTOM CONTROLS */}
      <div 
        className={`mt-auto relative p-8 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 md:gap-3 glass-card p-2 md:p-3 rounded-2xl md:rounded-[24px] shadow-2xl max-w-[95%]">
          {/* Mute button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className={`relative p-2.5 md:p-3 rounded-full transition-all duration-300 ${
              isMuted 
                ? "bg-[var(--danger)]/20 text-[var(--danger)] ring-2 ring-[var(--danger)]/30" 
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {isMuted && (
              <div className="absolute inset-0 rounded-full animate-ping bg-[var(--danger)]/20" />
            )}
            {isMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6 relative z-10" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
          </button>

          {/* Video toggle button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleVideo();
            }}
            className={`relative p-2.5 md:p-3 rounded-full transition-all duration-300 ${
              isVideoOff 
                ? "bg-[var(--danger)]/20 text-[var(--danger)] ring-2 ring-[var(--danger)]/30" 
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5 md:w-6 md:h-6" /> : <Video className="w-5 h-5 md:w-6 md:h-6" />}
          </button>

          {/* Chat button - Navigate to chat */}
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              // Minimize the call
              toggleMinimize();
              
              // Find or create conversation with recipient
              if (currentCall?.recipientId) {
                // Find existing conversation
                const existingConv = conversations.find(conv => 
                  conv.participants?.some(p => (p.user?.id || p.user_id) === currentCall.recipientId)
                );
                
                if (existingConv) {
                  setActiveConversation(existingConv.id);
                } else {
                  // Create new conversation
                  try {
                    const newConv = await conversationsApi.create(currentCall.recipientId);
                    setActiveConversation(newConv.id);
                  } catch (error) {
                    console.error("Failed to create conversation:", error);
                  }
                }
              }
              
              // Navigate to chat page
              router.push("/chat");
            }}
            className="p-2.5 md:p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all relative"
            title="Mở chat"
          >
            <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />
            <div className="absolute top-2.5 right-2.5 md:top-3.5 md:right-3.5 w-1.5 h-1.5 md:w-2 md:h-2 bg-[var(--primary)] rounded-full" />
          </button>

          {/* Volume button */}
          <button 
            onClick={(e) => e.stopPropagation()}
            className="p-2.5 md:p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
          >
            <Volume2 className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          {/* End call button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              endCall();
            }}
            className="relative p-3 md:p-4 bg-gradient-to-br from-[var(--danger)] to-[#e11d48] rounded-full transition-all shadow-xl shadow-[var(--danger)]/40 hover:shadow-[var(--danger)]/60 active:scale-90 group"
          >
            <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <PhoneOff className="w-5 h-5 md:w-6 md:h-6 text-white relative z-10" />
          </button>
        </div>
        
        <p className="mt-4 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] font-mono">
          HD Quality • Signaling Secured
        </p>
      </div>
    </div>
  );
}
