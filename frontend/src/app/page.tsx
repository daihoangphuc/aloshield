"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { authApi } from "@/lib/api";
import Cookies from "js-cookie";
import { Shield, Lock, MessageCircle, Video } from "lucide-react";
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
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--background)]">
      {/* Shield Logo */}
      <div className="relative mb-8 shield-animate">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/20 to-green-500/20 flex items-center justify-center">
          <Shield className="w-16 h-16 text-blue-500" strokeWidth={1.5} />
          <Lock className="w-6 h-6 text-white absolute" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold mb-2 gradient-text">ALO Shield</h1>
      <p className="text-[var(--muted)] mb-12 text-center">
        Chat & Video 1-1 Bảo Mật Cao
      </p>

      {/* Features */}
      <div className="flex gap-8 mb-12">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-[var(--card)] flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-blue-500" />
          </div>
          <span className="text-sm text-[var(--muted)]">Chat E2EE</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-[var(--card)] flex items-center justify-center">
            <Video className="w-6 h-6 text-green-500" />
          </div>
          <span className="text-sm text-[var(--muted)]">Video Call</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-[var(--card)] flex items-center justify-center">
            <Lock className="w-6 h-6 text-purple-500" />
          </div>
          <span className="text-sm text-[var(--muted)]">Bảo mật</span>
        </div>
      </div>

      {/* Auth Buttons */}
      <div className="w-full max-w-sm space-y-3">
        <Link
          href="/login"
          className="btn btn-primary w-full flex items-center justify-center gap-3 py-4"
        >
          Đăng Nhập
        </Link>
        <Link
          href="/register"
          className="btn btn-secondary w-full flex items-center justify-center gap-3 py-4"
        >
          Tạo Tài Khoản Mới
        </Link>
      </div>

      {/* Divider */}
      <div className="w-full max-w-sm flex items-center gap-4 my-4">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-xs text-[var(--muted)] uppercase">hoặc</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      {/* Google Login */}
      <GoogleLoginButton />

      {/* E2EE Badge */}
      <div className="mt-8 flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10">
        <Lock className="w-4 h-4 text-green-500" />
        <span className="text-sm text-green-500">Mã hóa Đầu-Cuối (E2EE)</span>
      </div>

      {/* Footer */}
      <div className="mt-12 flex gap-6 text-sm text-[var(--muted)]">
        <a href="#" className="hover:text-white transition-colors">
          Chính sách
        </a>
        <a href="#" className="hover:text-white transition-colors">
          Điều khoản
        </a>
      </div>
    </main>
  );
}
