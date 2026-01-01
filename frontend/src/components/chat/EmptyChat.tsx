"use client";

import { Shield, Lock, MessageSquare, Zap } from "lucide-react";

export function EmptyChat() {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center bg-[var(--chat-bg)] p-6 md:p-10 animate-in relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[var(--primary)]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-[var(--accent)]/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      </div>

      {/* Central Shield Logo */}
      <div className="relative mb-12 shield-animate z-10">
        <div className="w-[140px] h-[140px] rounded-full bg-[var(--primary)]/5 flex items-center justify-center border border-[var(--primary)]/10">
          <div className="w-[100px] h-[100px] rounded-full bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20 relative">
            <Shield className="w-14 h-14 text-[var(--primary)]" strokeWidth={1.2} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--chat-bg)] p-1.5 rounded-lg border border-white/10">
              <Lock className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-[var(--primary)]/20 blur-[60px] -z-10" />
      </div>

      <div className="text-center max-w-[500px] mb-12 z-10">
        <h2 className="text-[32px] font-black text-white mb-4 tracking-tight">
          ALO <span className="gradient-text">Shield</span>
        </h2>
        <p className="text-[16px] text-[var(--text-secondary)] leading-relaxed">
          Chọn một cuộc trò chuyện để bắt đầu nhắn tin an toàn. 
          Mọi dữ liệu được mã hóa đầu-cuối <span className="text-[var(--primary)] font-semibold">(E2EE)</span> và chỉ bạn với người nhận mới có quyền truy cập.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-[600px] z-10">
        <div className="card card-hover flex flex-col gap-3 p-6 group">
          <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--primary)]/20 transition-colors">
            <MessageSquare className="w-6 h-6 text-[var(--primary)]" />
          </div>
          <div>
            <p className="font-bold text-[16px] text-white mb-1">Mã hóa tin nhắn</p>
            <p className="text-[13px] text-[var(--text-muted)] leading-normal">
              Nội dung trò chuyện được bảo vệ bằng giao thức Double Ratchet.
            </p>
          </div>
        </div>

        <div className="card card-hover flex flex-col gap-3 p-6 group">
          <div className="w-12 h-12 rounded-xl bg-[var(--success)]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--success)]/20 transition-colors">
            <Lock className="w-6 h-6 text-[var(--success)]" />
          </div>
          <div>
            <p className="font-bold text-[16px] text-white mb-1">Quyền riêng tư</p>
            <p className="text-[13px] text-[var(--text-muted)] leading-normal">
              Server không thể đọc được tin nhắn hoặc xem tệp đính kèm của bạn.
            </p>
          </div>
        </div>
      </div>

      {/* Security Banner Footer */}
      <div className="mt-auto pt-10 z-10">
        <div className="badge badge-primary font-mono">
          <Shield className="w-4 h-4" />
          <span className="tracking-wider">ALO SHIELD E2EE VERIFIED</span>
        </div>
      </div>
    </div>
  );
}
