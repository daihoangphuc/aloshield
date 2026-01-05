import {
  memo,
  useRef,
} from "react";
import {
  ImageIcon,
  Paperclip,
  Send,
  Loader2,
  Layers,
  X,
  FileText,
  Video,
  Play,
} from "lucide-react";

interface ChatInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  isUploading: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  showStickerPicker: boolean;
  setShowStickerPicker: (show: boolean) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isMobile: boolean;
  isInputFocused: boolean;
  selectedFiles: File[];
  filePreviews: Map<string, string>;
  onClearFile: (fileName?: string) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export const ChatInput = memo(function ChatInput({
  inputValue,
  onSend,
  isSending,
  isUploading,
  onFileSelect,
  fileInputRef,
  imageInputRef,
  showStickerPicker,
  setShowStickerPicker,
  textareaRef,
  isMobile,
  isInputFocused,
  selectedFiles,
  filePreviews,
  onClearFile,
  handlePaste,
  handleInputChange,
}: ChatInputProps) {
  const stickerButtonRef = useRef<HTMLButtonElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* Files Preview - Floating above input */}
      {selectedFiles.length > 0 && (
        <div className="mx-3 md:mx-4 mb-2 animate-in slide-in-from-bottom-2 duration-200 z-40">
          <div className="bg-[#1a1f2e] border border-[var(--border)] rounded-2xl p-3 shadow-xl">
            {/* Header with count and clear all */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-white">
                {selectedFiles.length} {selectedFiles.length === 1 ? 'tệp đã chọn' : 'tệp đã chọn'}
              </p>
              <button
                onClick={() => onClearFile()}
                className="text-xs text-[var(--text-muted)] hover:text-white transition-colors"
                title="Xóa tất cả"
              >
                Xóa tất cả
              </button>
            </div>

            {/* Files list */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedFiles.map((file, index) => {
                const preview = filePreviews.get(file.name);
                return (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-3 bg-[#0d1117]/50 rounded-xl p-2">
                    {/* File icon/preview */}
                    <div className="relative flex-shrink-0">
                      {preview ? (
                        <div className="relative">
                          <img
                            src={preview}
                            alt={file.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          <div className="absolute inset-0 rounded-lg ring-1 ring-white/10" />
                        </div>
                      ) : (
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          file.type.startsWith("video/")
                            ? "bg-purple-500/20"
                            : file.type.startsWith("audio/")
                              ? "bg-green-500/20"
                              : file.type.includes("pdf")
                                ? "bg-red-500/20"
                                : "bg-blue-500/20"
                        }`}>
                          {file.type.startsWith("video/") ? (
                            <Video size={18} className="text-purple-400" />
                          ) : file.type.startsWith("audio/") ? (
                            <Play size={18} className="text-green-400" />
                          ) : file.type.includes("pdf") ? (
                            <FileText size={18} className="text-red-400" />
                          ) : (
                            <FileText size={18} className="text-blue-400" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{file.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {file.size < 1024 * 1024
                          ? `${(file.size / 1024).toFixed(1)} KB`
                          : `${(file.size / 1024 / 1024).toFixed(2)} MB`
                        }
                      </p>
                    </div>

                    {/* Remove single file button */}
                    <button
                      onClick={() => onClearFile(file.name)}
                      className="p-1 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                      title="Xóa tệp này"
                    >
                      <X size={14} className="text-[var(--text-muted)] hover:text-white" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Upload progress bar */}
            {isUploading && (
              <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div
        ref={inputAreaRef}
        className={`p-3 md:p-4 bg-[var(--chat-bg)] flex items-end gap-2 md:gap-3 flex-shrink-0 border-t border-[var(--border)] ${
          isMobile ? "pb-4" : ""
        } z-[95]`}
        style={
          isMobile && isInputFocused
            ? {
                position: "fixed",
                bottom: "0px",
                left: 0,
                right: 0,
                paddingBottom: `max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)))`,
                paddingLeft: "calc(0.75rem + env(safe-area-inset-left, 0px))",
                paddingRight: "calc(0.75rem + env(safe-area-inset-right, 0px))",
                transition: "none",
                boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.3)",
                zIndex: 100,
              }
            : isMobile
            ? {
                paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
                position: "relative",
                transition: "bottom 0.2s ease-out",
              }
            : {
                position: "relative",
              }
        }
      >
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFileSelect(e, true)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          className="hidden"
          onChange={(e) => onFileSelect(e, false)}
        />

        <div className="flex items-center flex-shrink-0 -ml-1">
          <button
            onClick={() => imageInputRef.current?.click()}
            className="p-3 md:p-2.5 hover:bg-white/5 rounded-xl transition-all active:scale-90"
            title="Đính kèm hình ảnh"
            aria-label="Attach Image"
          >
            <ImageIcon
              size={22}
              className="text-[var(--text-muted)] hover:text-[var(--primary)] md:w-5 md:h-5"
            />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 md:p-2.5 hover:bg-white/5 rounded-xl transition-all active:scale-90"
            title="Đính kèm tệp"
            aria-label="Attach File"
          >
            <Paperclip
              size={22}
              className="text-[var(--text-muted)] hover:text-[var(--primary)] md:w-5 md:h-5"
            />
          </button>
        </div>

        <div className="flex-1 min-w-0 relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-[20px] md:rounded-[24px] opacity-0 group-focus-within:opacity-30 blur-sm transition-opacity duration-500" />
          <div className="relative bg-[#0d1117] rounded-[20px] md:rounded-[24px] pl-4 pr-3 py-3 md:py-3 flex items-center gap-2 border border-[var(--border)] group-focus-within:border-[var(--primary)]/50 transition-all duration-300">
            <textarea
              ref={textareaRef}
              placeholder="Nhập tin nhắn..."
              className="flex-1 bg-transparent border-none outline-none text-white text-[16px] md:text-[15px] placeholder:text-[var(--text-muted)] resize-none max-h-24 min-h-[24px] overflow-y-auto leading-relaxed"
              // text-[16px] prevents iOS zoom on focus
              rows={1}
              value={inputValue}
              onChange={(e) => {
                handleInputChange(e);
                e.target.style.height = "inherit";
                e.target.style.height = `${Math.min(
                  e.target.scrollHeight,
                  96
                )}px`;
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              disabled={isSending || isUploading}
              aria-label="Message Input"
            />
            <button
              ref={stickerButtonRef}
              onClick={() => setShowStickerPicker(!showStickerPicker)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-90 flex-shrink-0 relative -mr-1"
              aria-label="Open Sticker Picker"
            >
              <Layers
                size={20}
                className="text-[var(--text-muted)] hover:text-white md:w-[18px] md:h-[18px]"
              />
            </button>
          </div>
        </div>

        <button
          onClick={onSend}
          disabled={
            (!inputValue.trim() && selectedFiles.length === 0) ||
            isSending ||
            isUploading
          }
          aria-label="Send Message"
          className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
            (inputValue.trim() || selectedFiles.length > 0) &&
            !isSending &&
            !isUploading
              ? "bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg shadow-[var(--primary-glow)] hover:scale-105 active:scale-95"
              : "bg-[var(--card)] border border-[var(--border)] text-[var(--text-muted)]"
          }`}
        >
          {isSending || isUploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send
              size={18}
              className={
                inputValue.trim() || selectedFiles.length > 0
                  ? "translate-x-0.5 -translate-y-0.5"
                  : ""
              }
            />
          )}
        </button>
      </div>
    </>
  );
});
