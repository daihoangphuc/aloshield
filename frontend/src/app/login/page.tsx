"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, Mail, Eye, EyeOff, Loader2, ArrowRight, AlertCircle, CheckCircle } from "lucide-react";
import { config } from "@/lib/config";
import { useAuthStore } from "@/stores/authStore";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import Cookies from "js-cookie";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setSuccessMessage("Đăng ký thành công! Vui lòng đăng nhập.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${config.apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Đăng nhập thất bại");
      }

      // Save token and redirect
      Cookies.set("accessToken", data.accessToken, { expires: 1 / 96 });
      login(data.accessToken, data.user);
      router.push("/chat");
    } catch (err: any) {
      setError(err.message || "Email hoặc mật khẩu không đúng");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center p-6 py-16 overflow-x-hidden bg-[var(--background)]">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--primary)]/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[var(--accent)]/8 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center animate-in">
        {/* Shield Logo Mini */}
        <div className="relative mb-8 shield-animate">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/20 flex items-center justify-center border border-white/10 backdrop-blur-xl">
            <Shield className="w-10 h-10 text-[var(--primary)]" strokeWidth={1.5} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--background)] p-1.5 rounded-lg border border-white/10">
              <Lock className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-black mb-3 text-white tracking-tight">
          Chào mừng <span className="gradient-text">trở lại</span>
        </h1>
        <p className="text-[var(--text-muted)] mb-10 text-center font-medium">
          Đăng nhập để tiếp tục cuộc trò chuyện bảo mật
        </p>

        {/* Auth Card */}
        <div className="w-full card p-8 shadow-2xl">
          {/* Tab Switcher */}
          <div className="flex bg-[var(--background)] rounded-2xl p-1.5 mb-8 border border-[var(--border)]">
            <button className="flex-1 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-lg">
              Đăng Nhập
            </button>
            <Link
              href="/register"
              className="flex-1 py-3 text-sm font-bold rounded-xl text-[var(--text-muted)] hover:text-white transition-colors text-center"
            >
              Đăng Ký
            </Link>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {successMessage && (
              <div className="p-4 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-2xl flex items-center gap-3 slide-up">
                <CheckCircle className="w-5 h-5 text-[var(--success)] flex-shrink-0" />
                <span className="text-[var(--success)] text-sm font-medium">{successMessage}</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-2xl flex items-center gap-3 slide-up">
                <AlertCircle className="w-5 h-5 text-[var(--danger)] flex-shrink-0" />
                <span className="text-[var(--danger)] text-sm font-medium">{error}</span>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] ml-1">
                Email / Username
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="input-field pl-12"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-end ml-1">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">
                  Mật khẩu
                </label>
                <Link 
                  href="/forgot-password" 
                  className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-widest hover:text-[var(--primary-hover)] transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="input-field pl-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-[var(--text-muted)]" />
                  ) : (
                    <Eye className="w-5 h-5 text-[var(--text-muted)]" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-4 mt-6 group"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Truy Cập Hệ Thống
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Social Login */}
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">Hoặc</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
            </div>

            <GoogleLoginButton />
          </div>
        </div>

        {/* E2EE Trust Badge */}
        <div className="mt-10 flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-white/5 bg-white/5 backdrop-blur-sm">
          <Shield className="w-4 h-4 text-[var(--success)]" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-[var(--text-muted)] font-mono">
            Mã hóa 256-bit AES
          </span>
        </div>

        {/* Footer */}
        <div className="mt-10 flex gap-8 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em]">
          <a href="#" className="hover:text-white transition-colors">Chính sách</a>
          <a href="#" className="hover:text-white transition-colors">Điều khoản</a>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
