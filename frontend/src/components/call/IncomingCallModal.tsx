"use client";

import { useEffect, useState } from "react";
import { useCallStore } from "@/stores/callStore";
import { Phone, PhoneOff, Video, X, Lock } from "lucide-react";

export function IncomingCallModal() {
  const { incomingCall, acceptCall, rejectCall } = useCallStore();
  const [isRinging, setIsRinging] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Play ringtone effect
  useEffect(() => {
    if (incomingCall) {
      setIsRinging(true);
      
      // Create oscillator for ringtone
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(ctx);
        
        const playRingtone = () => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          oscillator.frequency.value = 440;
          oscillator.type = "sine";
          gainNode.gain.value = 0.3;
          
          oscillator.start();
          
          // Ring pattern: on 1s, off 1s
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.8);
          
          oscillator.stop(ctx.currentTime + 0.8);
        };
        
        // Play ringtone repeatedly
        const interval = setInterval(playRingtone, 1500);
        playRingtone();
        
        return () => {
          clearInterval(interval);
          ctx.close();
        };
      } catch (error) {
        console.error("Failed to play ringtone:", error);
      }
    } else {
      setIsRinging(false);
      if (audioContext) {
        audioContext.close();
        setAudioContext(null);
      }
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const handleAccept = async () => {
    try {
      await acceptCall();
    } catch (error) {
      console.error("Failed to accept call:", error);
    }
  };

  const handleReject = () => {
    rejectCall("declined");
  };

  const isVideoCall = incomingCall.callType === "video";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-[var(--primary)]/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] bg-[var(--accent)]/15 rounded-full blur-[120px] animate-pulse [animation-delay:0.5s]" />
      </div>

      {/* Modal Card */}
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 w-full max-w-sm mx-4 shadow-2xl animate-in">
        {/* Close button */}
        <button
          onClick={handleReject}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-all text-[var(--text-muted)] hover:text-white"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center text-center">
          {/* Call type badge */}
          <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--primary)]/10 rounded-full mb-6">
            {isVideoCall ? (
              <Video size={14} className="text-[var(--primary)]" />
            ) : (
              <Phone size={14} className="text-[var(--primary)]" />
            )}
            <span className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">
              {isVideoCall ? "Video Call" : "Audio Call"}
            </span>
          </div>

          {/* Avatar with pulse animation */}
          <div className="relative mb-6">
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-full bg-[var(--primary)]/20 animate-ping" style={{ animationDuration: "1.5s" }} />
            <div className="absolute inset-[-8px] rounded-full bg-[var(--primary)]/10 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.3s" }} />
            
            <div className="avatar-ring w-28 h-28 relative">
              <div className="w-full h-full rounded-full bg-[var(--card)] overflow-hidden">
                {incomingCall.callerAvatar ? (
                  <img
                    src={incomingCall.callerAvatar}
                    alt={incomingCall.callerName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-black text-3xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                    {incomingCall.callerName?.[0] || "?"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Caller info */}
          <h2 className="text-2xl font-black text-white mb-2">
            {incomingCall.callerName}
          </h2>
          <p className="text-[var(--text-muted)] mb-2">
            đang gọi cho bạn...
          </p>
          
          {/* Security badge */}
          <div className="flex items-center gap-1.5 text-[var(--success)] mb-8">
            <Lock size={12} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Cuộc gọi được mã hóa
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-6">
            {/* Reject button */}
            <button
              onClick={handleReject}
              className="group flex flex-col items-center gap-2"
            >
              <div className="p-5 bg-gradient-to-br from-[var(--danger)] to-[#e11d48] rounded-full shadow-xl shadow-[var(--danger)]/30 transition-all group-hover:shadow-[var(--danger)]/50 group-hover:scale-105 group-active:scale-95">
                <PhoneOff className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                Từ chối
              </span>
            </button>

            {/* Accept button */}
            <button
              onClick={handleAccept}
              className="group flex flex-col items-center gap-2"
            >
              <div className="p-5 bg-gradient-to-br from-[var(--success)] to-[#059669] rounded-full shadow-xl shadow-[var(--success)]/30 transition-all group-hover:shadow-[var(--success)]/50 group-hover:scale-105 group-active:scale-95 animate-pulse">
                {isVideoCall ? (
                  <Video className="w-7 h-7 text-white" />
                ) : (
                  <Phone className="w-7 h-7 text-white" />
                )}
              </div>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                Chấp nhận
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}





