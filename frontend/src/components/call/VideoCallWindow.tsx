"use client";

import { useEffect, useRef, useState } from "react";
import { useCallStore } from "@/stores/callStore";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  MoreVertical, 
  UserPlus, 
  ChevronDown, 
  Shield, 
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
  const [timer, setTimer] = useState("00:00");

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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
    <div className="fixed inset-0 z-[100] bg-[#1a1a1a] flex flex-col animate-in">
      {/* REMOTE VIDEO (FULL SCREEN) */}
      <div className="absolute inset-0 overflow-hidden">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#2a2a2a]">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#3b82f6] mb-6">
              <img 
                src={currentCall.recipientAvatar || "/default-avatar.png"} 
                className="w-full h-full object-cover" 
                alt=""
              />
            </div>
            <h2 className="text-2xl font-bold text-white">{currentCall.recipientName}</h2>
            <p className="text-[#8696a0] mt-2 animate-pulse">Đang kết nối bảo mật...</p>
          </div>
        )}
      </div>

      {/* TOP HEADER */}
      <div className="relative flex items-center justify-between p-6 bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={endCall} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all">
          <ChevronDown className="text-white w-6 h-6" />
        </button>
        
        <div className="flex flex-col items-center">
          <h3 className="text-white font-bold text-lg">{currentCall.recipientName || "Đang gọi..."}</h3>
          <div className="flex items-center gap-2 mt-1 px-3 py-1 bg-black/30 rounded-full backdrop-blur-md border border-white/10">
            <Lock className="w-3.5 h-3.5 text-[#3b82f6] fill-[#3b82f6]/20" />
            <span className="text-white text-xs font-medium tracking-wider">{timer}</span>
            <span className="text-[#22c55e] text-xs font-bold ml-1">• Encrypted</span>
          </div>
        </div>

        <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all">
          <UserPlus className="text-white w-6 h-6" />
        </button>
      </div>

      {/* LOCAL VIDEO (FLOATING) */}
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
          <div className="w-full h-full flex items-center justify-center bg-[#333]">
            <VideoOff className="text-white/20 w-10 h-10" />
          </div>
        )}
        {isMuted && (
          <div className="absolute bottom-2 right-2 p-1.5 bg-red-500 rounded-full">
            <MicOff className="text-white w-3 h-3" />
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="mt-auto relative p-8 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center">
        <div className="flex items-center gap-4 md:gap-6 bg-black/40 p-4 rounded-[32px] backdrop-blur-xl border border-white/10 shadow-2xl">
          <button 
            onClick={toggleMute}
            className={`p-4 rounded-full transition-all ${isMuted ? "bg-white/10 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button 
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all ${isVideoOff ? "bg-white/10 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>

          <button className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all relative">
            <MessageSquare className="w-6 h-6" />
            <div className="absolute top-3.5 right-3.5 w-2 h-2 bg-[#3b82f6] rounded-full" />
          </button>

          <button className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
            <Volume2 className="w-6 h-6" />
          </button>

          <button 
            onClick={endCall}
            className="p-5 bg-red-500 hover:bg-red-600 rounded-full transition-all shadow-lg shadow-red-500/40 active:scale-90"
          >
            <PhoneOff className="w-7 h-7 text-white fill-current" />
          </button>
        </div>
        
        <p className="mt-4 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">HD Quality Signaling Secured</p>
      </div>
    </div>
  );
}

