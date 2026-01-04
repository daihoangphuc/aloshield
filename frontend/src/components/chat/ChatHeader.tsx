import { memo } from "react";
import { ArrowLeft, Video, Phone, MoreVertical, Lock } from "lucide-react";

interface ChatHeaderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  otherParticipant: any; // Type should be refined based on actual User type
  isOtherTyping: boolean;
  isMobile: boolean;
  onBack: () => void;
  onVideoCall: () => void;
  onAudioCall: () => void;
}

export const ChatHeader = memo(function ChatHeader({
  otherParticipant,
  isOtherTyping,
  isMobile,
  onBack,
  onVideoCall,
  onAudioCall,
}: ChatHeaderProps) {
  return (
    <header
      className={`flex items-center justify-between px-3 md:px-6 border-b border-[var(--border)] bg-[var(--chat-bg)]/95 backdrop-blur-xl flex-shrink-0 ${
        isMobile ? "fixed top-0 left-0 right-0 z-30" : "z-10"
      }`}
      style={
        isMobile
          ? {
              top: "env(safe-area-inset-top, 0px)",
              paddingTop: `max(0.75rem, calc(0.75rem + env(safe-area-inset-top, 0px)))`,
              paddingBottom: "0.75rem",
              paddingLeft: "calc(0.75rem + env(safe-area-inset-left, 0px))",
              paddingRight: "calc(0.75rem + env(safe-area-inset-right, 0px))",
              minHeight: "70px",
              height: "auto",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
            }
          : {
              height: "80px",
            }
      }
    >
      <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1 overflow-hidden">
        {isMobile && (
          <button
            onClick={onBack}
            className="p-2 -ml-1 hover:bg-white/5 rounded-full transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={22} className="text-white" />
          </button>
        )}
        <div className="relative flex-shrink-0">
          <div className="avatar-ring w-10 h-10 md:w-12 md:h-12 transition-transform duration-300 hover:scale-105">
            <div className="w-full h-full rounded-full bg-[var(--chat-bg)] overflow-hidden">
              {otherParticipant.avatar_url ? (
                <img
                  src={otherParticipant.avatar_url}
                  alt={otherParticipant.display_name || "User Avatar"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-black text-lg md:text-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                  {otherParticipant.display_name?.[0] ||
                    otherParticipant.username?.[0]}
                </div>
              )}
            </div>
          </div>
          {otherParticipant.is_online && (
            <div className="online-indicator absolute bottom-0 right-0 border-2 border-[var(--chat-bg)]" />
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 md:gap-2">
            <h3 className="font-bold text-white text-[15px] md:text-[17px] truncate tracking-tight max-w-[120px] sm:max-w-[180px] md:max-w-none">
              {otherParticipant.display_name || otherParticipant.username}
            </h3>
            <div className="px-1 py-0.5 rounded-md bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex-shrink-0">
              <Lock size={10} className="text-[var(--primary)]" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isOtherTyping ? (
              <div className="flex gap-1 items-center px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 animate-pulse">
                <span className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-wider">
                  Đang nhập
                </span>
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 bg-[var(--primary)] rounded-full animate-bounce" />
                  <span
                    className="w-1 h-1 bg-[var(--primary)] rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="w-1 h-1 bg-[var(--primary)] rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
            ) : otherParticipant.is_online ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_var(--success-glow)]" />
                <span className="text-[11px] text-[var(--success)] font-medium">
                  Đang hoạt động
                </span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                  Ngoại tuyến
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 md:gap-2 flex-shrink-0">
        <button
          onClick={onVideoCall}
          className="p-2 md:p-2.5 hover:bg-white/5 rounded-xl transition-all group active:scale-90"
          title="Cuộc gọi video"
          aria-label="Video Call"
        >
          <Video
            size={20}
            className="text-[var(--primary)] group-hover:drop-shadow-[0_0_8px_var(--primary-glow)] transition-all"
          />
        </button>
        <button
          onClick={onAudioCall}
          className="p-2 md:p-2.5 hover:bg-white/5 rounded-xl transition-all group active:scale-90"
          title="Cuộc gọi âm thanh"
          aria-label="Audio Call"
        >
          <Phone
            size={20}
            className="text-[var(--primary)] group-hover:drop-shadow-[0_0_8px_var(--primary-glow)] transition-all"
          />
        </button>
        <button
          className="p-2 md:p-2.5 hover:bg-white/5 rounded-xl transition-all group active:scale-90"
          aria-label="More options"
        >
          <MoreVertical
            size={20}
            className="text-[var(--text-muted)] group-hover:text-white"
          />
        </button>
      </div>
    </header>
  );
});
