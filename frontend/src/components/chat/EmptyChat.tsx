"use client";

import { Shield, Lock, MessageSquare } from "lucide-react";

export function EmptyChat() {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center bg-[var(--chat-bg)] p-6 md:p-10 animate-in">
      {/* Central Shield Logo */}
      <div className="relative mb-12">
        <div className="w-[140px] h-[140px] rounded-full bg-[var(--blue-accent)]/5 flex items-center justify-center border border-[var(--blue-accent)]/10">
          <div className="w-[100px] h-[100px] rounded-full bg-[var(--blue-accent)]/10 flex items-center justify-center border border-[var(--blue-accent)]/20 shadow-[0_0_60px_rgba(59,130,246,0.15)] relative">
            <Shield className="w-14 h-14 text-[var(--blue-accent)]" strokeWidth={1.2} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--chat-bg)] p-1 rounded-md">
              <Lock className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center max-w-[500px] mb-12">
        <h2 className="text-[32px] font-bold text-[var(--text-primary)] mb-4 tracking-tight">ALO Shield</h2>
        <p className="text-[16px] text-[var(--text-secondary)] leading-relaxed">
          Chọn một cuộc trò chuyện để bắt đầu nhắn tin an toàn. 
          Mọi dữ liệu được mã hóa đầu-cuối (E2EE) và chỉ bạn với người nhận mới có quyền truy cập.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-[600px]">
        <div className="flex flex-col gap-3 p-6 bg-[var(--card-bg)]/40 rounded-2xl border border-[var(--border)] group hover:bg-[var(--card-bg)]/60 transition-all">
          <div className="w-10 h-10 rounded-xl bg-[var(--blue-accent)]/10 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-[var(--blue-accent)]" />
          </div>
          <div>
            <p className="font-bold text-[16px] text-[var(--text-primary)] mb-1">Mã hóa tin nhắn</p>
            <p className="text-[13px] text-[var(--text-muted)] leading-normal">
              Nội dung trò chuyện được bảo vệ bằng giao thức Double Ratchet.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-6 bg-[var(--card-bg)]/40 rounded-2xl border border-[var(--border)] group hover:bg-[var(--card-bg)]/60 transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#22c55e]/10 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-[#22c55e]" />
          </div>
          <div>
            <p className="font-bold text-[16px] text-[var(--text-primary)] mb-1">Quyền riêng tư</p>
            <p className="text-[13px] text-[var(--text-muted)] leading-normal">
              Server không thể đọc được tin nhắn hoặc xem tệp đính kèm của bạn.
            </p>
          </div>
        </div>
      </div>

      {/* Security Banner Footer */}
      <div className="mt-auto pt-10">
        <div className="flex items-center gap-2.5 text-[12px] text-[var(--text-muted)] bg-[var(--card-bg)]/30 px-5 py-2.5 rounded-full border border-[var(--border)]">
          <Shield className="w-4 h-4 text-[var(--blue-accent)] opacity-70" />
          <span className="font-medium tracking-wide">ALO SHIELD END-TO-END ENCRYPTION VERIFIED</span>
        </div>
      </div>
    </div>
  );
}
