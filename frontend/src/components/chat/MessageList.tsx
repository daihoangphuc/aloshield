import {
  memo,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { MessageItem } from "./MessageItem";
import { Loader2, Lock } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Message } from "@/lib/api";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onImageClick: (url: string, fileName: string) => void;
  onDownload: (id: string, fileName: string) => void;
  onReaction: (id: string, emoji: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onReply: (msg: Message) => void;
  isOtherTyping: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  otherParticipant: any;
  isMobile: boolean;
  keyboardHeight: number;
  isInputFocused: boolean;
}

export const MessageList = memo(function MessageList({
  messages,
  isLoading,
  onImageClick,
  onDownload,
  onReaction,
  onDelete,
  onEdit,
  onReply,
  isOtherTyping,
  otherParticipant,
  isMobile,
  keyboardHeight,
  isInputFocused,
}: MessageListProps) {
  const { user } = useAuthStore();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Auto scroll to bottom when new messages arrive if we were already at bottom
  useEffect(() => {
    if (atBottom && virtuosoRef.current) {
      // Small timeout to ensure DOM is updated
      setTimeout(() => {
         virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: "end" });
      }, 50);
    }
  }, [messages.length, atBottom]);

  // Initial Scroll to bottom
  useEffect(() => {
     if (messages.length > 0 && virtuosoRef.current) {
       // We use a small timeout to let Virtuoso compute heights
       setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: "end" });
       }, 100);
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount if messages exist, or when they first load

  const Header = () => (
    <div className="flex justify-center mb-4 md:mb-6 pt-2 md:pt-2">
      <div className="glass-card p-3 md:p-4 rounded-2xl max-w-[90%] md:max-w-[85%] flex items-start gap-2 md:gap-3">
        <Lock
          size={14}
          className="text-[var(--text-muted)] mt-0.5 flex-shrink-0"
        />
        <p className="text-[11px] md:text-[12px] text-[var(--text-muted)] leading-relaxed">
          Tin nhắn và cuộc gọi được mã hóa đầu cuối. Không ai bên ngoài cuộc trò
          chuyện này có thể đọc hoặc nghe chúng.
        </p>
      </div>
    </div>
  );

  const Footer = () => {
    if (!isOtherTyping) return <div className="pb-4" />;
    return (
      <div className="flex items-center gap-2 animate-in mb-2 pb-4 px-3 md:px-4">
        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
          {otherParticipant.avatar_url ? (
            <img
              src={otherParticipant.avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
              {otherParticipant.display_name?.[0] ||
                otherParticipant.username?.[0]}
            </div>
          )}
        </div>
        <div className="bg-[var(--card)] px-4 py-2.5 rounded-2xl rounded-bl-md border border-[var(--border)]">
          <div className="flex gap-1">
            <span className="typing-dot w-2 h-2 bg-[var(--text-muted)] rounded-full" />
            <span className="typing-dot w-2 h-2 bg-[var(--text-muted)] rounded-full" />
            <span className="typing-dot w-2 h-2 bg-[var(--text-muted)] rounded-full" />
          </div>
        </div>
      </div>
    );
  };

  const itemContent = useCallback(
    (index: number, msg: Message) => {
      const isMe = msg.sender_id === user?.id;
      const showDate =
        index === 0 ||
        new Date(msg.created_at).toDateString() !==
          new Date(messages[index - 1].created_at).toDateString();

      // Ensure stable key
      const key = msg._renderKey || msg.id;

      return (
        <div className="px-3 md:px-4 py-1">
          <MessageItem
            key={key}
            msg={msg}
            isMe={isMe}
            showDate={showDate}
            onImageClick={onImageClick}
            onDownload={onDownload}
            onReaction={onReaction}
            onDelete={onDelete}
            onEdit={onEdit}
            onReply={onReply}
          />
        </div>
      );
    },
    [messages, user?.id, onImageClick, onDownload, onReaction, onDelete, onEdit, onReply]
  );

  // Compute padding bottom based on mobile input state
  // This logic mimics the original ChatWindow padding calculation
  const paddingBottom = useMemo(() => {
    if (!isMobile) return "1.5rem";
    if (isInputFocused) {
        return `calc(${keyboardHeight > 0 ? keyboardHeight + 80 : 80}px + env(safe-area-inset-bottom, 0px))`;
    }
    return "calc(1.5rem + env(safe-area-inset-bottom, 0px))";
  }, [isMobile, isInputFocused, keyboardHeight]);

  const paddingTop = isMobile
    ? "calc(env(safe-area-inset-top, 0px) + max(0.75rem, calc(0.75rem + env(safe-area-inset-top, 0px))) + 70px + 0.75rem + 1.5rem)"
    : "calc(80px + 1.5rem)";

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div
        className="flex-1 h-full"
        style={{
             // Ensure it takes full height but respects parent flex
             minHeight: 0
        }}
    >
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        itemContent={itemContent}
        components={{
          Header: Header,
          Footer: Footer,
        }}
        style={{ height: "100%" }}
        atBottomStateChange={(bottom) => {
            setAtBottom(bottom);
        }}
        followOutput={"auto"}
        alignToBottom={true} // Start at bottom
        // Add padding to container via style prop on the list/scroller
        // However, Virtuoso handles this better via container class or direct style on the list
        // We need to apply the specific paddings for the fixed header/footer
      />
      <style>{`
        /* Custom styles for Virtuoso Scroller to match our layout */
        div[data-test-id="virtuoso-scroller"] {
            padding-top: ${paddingTop};
            padding-bottom: ${paddingBottom};
            transition: padding-bottom 0.2s ease-out;
        }
      `}</style>
    </div>
  );
});
