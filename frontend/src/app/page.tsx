"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { authApi } from "@/lib/api";
import Cookies from "js-cookie";
import { Shield, Lock, MessageCircle, Video, Zap, Globe } from "lucide-react";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      const token = Cookies.get("accessToken");
      if (token) {
        try {
          const user = await authApi.getMe();
          setUser(user);
          router.push("/chat");
        } catch {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, setUser, setLoading]);

  if (isAuthenticated) {
    router.push("/chat");
    return null;
  }

  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center p-6 py-12 overflow-x-hidden bg-[var(--background)]">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-[var(--primary)]/15 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-[var(--accent)]/10 rounded-full blur-[120px] animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--primary)]/5 rounded-full blur-[200px]" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>
      
      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl text-center">
        {/* Shield Logo */}
        <div className="relative mb-12 shield-animate group">
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/20 flex items-center justify-center border border-white/10 backdrop-blur-xl">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[var(--primary)]/30 to-[var(--accent)]/30 flex items-center justify-center border border-white/10">
              <Shield className="w-16 h-16 text-[var(--primary)] group-hover:scale-110 transition-transform duration-500" strokeWidth={1.5} />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--background)] p-2 rounded-xl border border-white/10 shadow-2xl">
              <Lock className="w-6 h-6 text-white" />
            </div>
          </div>
          {/* Pulsing rings */}
          <div className="absolute inset-0 rounded-full border border-[var(--primary)]/20 animate-ping [animation-duration:3s]" />
          <div className="absolute inset-[-10px] rounded-full border border-[var(--accent)]/10 animate-ping [animation-duration:4s] [animation-delay:0.5s]" />
        </div>

        {/* Title & Description */}
        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight text-white leading-tight">
          ALO <span className="gradient-text-glow">Shield</span>
        </h1>
        <p className="text-lg md:text-xl text-[var(--text-secondary)] mb-14 max-w-lg leading-relaxed font-medium">
          Nền tảng nhắn tin và gọi video 1-1 tối mật với công nghệ mã hóa đầu-cuối <span className="text-[var(--primary)] font-semibold">(E2EE)</span> cấp quân đội.
        </p>

        {/* Features Grid */}
        <div className="grid grid-cols-3 gap-6 md:gap-10 mb-16 w-full max-w-lg">
          {[
            { icon: MessageCircle, label: "Chat E2EE", color: "text-[var(--primary)]", bg: "bg-[var(--primary)]/10", border: "border-[var(--primary)]/20" },
            { icon: Video, label: "Video HD", color: "text-[var(--success)]", bg: "bg-[var(--success)]/10", border: "border-[var(--success)]/20" },
            { icon: Shield, label: "Bảo mật", color: "text-[var(--accent)]", bg: "bg-[var(--accent)]/10", border: "border-[var(--accent)]/20" },
          ].map((feature, i) => (
            <div key={i} className="flex flex-col items-center gap-4 group stagger-item">
              <div className={`w-16 h-16 rounded-2xl ${feature.bg} flex items-center justify-center border ${feature.border} group-hover:scale-110 group-hover:border-white/20 transition-all duration-300`}>
                <feature.icon className={`w-8 h-8 ${feature.color}`} />
              </div>
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em]">{feature.label}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-sm space-y-4">
          <Link href="/login" className="btn btn-primary w-full text-lg py-5 hover-lift">
            Đăng Nhập Ngay
          </Link>
          <Link href="/register" className="btn btn-secondary w-full text-lg py-5 hover-lift">
            Tạo Tài Khoản Mới
          </Link>
          
          <div className="flex items-center gap-4 py-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">hoặc tiếp tục với</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <GoogleLoginButton />
        </div>

        {/* E2EE Trust Badge */}
        <div className="mt-14 inline-flex items-center gap-3 px-6 py-3 rounded-full border border-[var(--success)]/20 bg-[var(--success)]/5 backdrop-blur-sm">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--success)]" />
            <div className="absolute inset-0 rounded-full bg-[var(--success)] animate-ping opacity-75" />
          </div>
          <span className="text-[12px] font-bold tracking-wide uppercase text-[var(--success)] font-mono">
            Giao thức E2EE đã kích hoạt
          </span>
        </div>

        {/* Footer Links */}
        <footer className="mt-16 flex gap-8 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em]">
          <a href="#" className="hover:text-white transition-colors duration-200">Chính sách</a>
          <a href="#" className="hover:text-white transition-colors duration-200">Điều khoản</a>
          <a href="#" className="hover:text-white transition-colors duration-200">Hỗ trợ</a>
        </footer>
      </div>
    </main>
  );
}
