"use client";

import { useEffect, useRef, useState } from "react";
import { useCallStore } from "@/stores/callStore";
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
  const { 
    currentCall, 
    localStream, 
    remoteStream, 
    isMuted, 
    isVideoOff, 
    toggleMute,
    toggleVideo,
    endCall 
  } = useCallStore();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [timer, setTimer] = useState("00:00");

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
      // For video calls, use video element
      if (currentCall?.callType === "video" && remoteVideoRef.current) {
        console.log("🎥 Setting remote video srcObject");
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(e => console.error("Error playing remote video:", e));
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
      // Clear audio element when stream is removed
      if (remoteAudioRef.current && currentCall?.callType === "audio") {
        remoteAudioRef.current.srcObject = null;
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
      {/* REMOTE VIDEO (FULL SCREEN) */}
      <div className="absolute inset-0 overflow-hidden">
        {remoteStream && currentCall.callType === "video" ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
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
      <div className="relative flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent">
        <button 
          onClick={endCall} 
          className="p-3 glass-card rounded-full hover:bg-white/10 transition-all"
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

      {/* LOCAL VIDEO (FLOATING) - Only show for video calls */}
      {currentCall.callType === "video" && (
        <div className="absolute top-24 right-6 w-32 h-48 md:w-40 md:h-60 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black animate-in">
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
      <div className="mt-auto relative p-8 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center">
        <div className="flex items-center gap-4 md:gap-6 glass-card p-4 rounded-[32px] shadow-2xl">
          {/* Mute button */}
          <button 
            onClick={toggleMute}
            className={`relative p-4 rounded-full transition-all duration-300 ${
              isMuted 
                ? "bg-[var(--danger)]/20 text-[var(--danger)] ring-2 ring-[var(--danger)]/30" 
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {isMuted && (
              <div className="absolute inset-0 rounded-full animate-ping bg-[var(--danger)]/20" />
            )}
            {isMuted ? <MicOff className="w-6 h-6 relative z-10" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Video toggle button */}
          <button 
            onClick={toggleVideo}
            className={`relative p-4 rounded-full transition-all duration-300 ${
              isVideoOff 
                ? "bg-[var(--danger)]/20 text-[var(--danger)] ring-2 ring-[var(--danger)]/30" 
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>

          {/* Chat button */}
          <button className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all relative">
            <MessageSquare className="w-6 h-6" />
            <div className="absolute top-3.5 right-3.5 w-2 h-2 bg-[var(--primary)] rounded-full" />
          </button>

          {/* Volume button */}
          <button className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
            <Volume2 className="w-6 h-6" />
          </button>

          {/* End call button */}
          <button 
            onClick={endCall}
            className="relative p-5 bg-gradient-to-br from-[var(--danger)] to-[#e11d48] rounded-full transition-all shadow-xl shadow-[var(--danger)]/40 hover:shadow-[var(--danger)]/60 active:scale-90 group"
          >
            <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <PhoneOff className="w-7 h-7 text-white relative z-10" />
          </button>
        </div>
        
        <p className="mt-4 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] font-mono">
          HD Quality • Signaling Secured
        </p>
      </div>
    </div>
  );
}
