"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, Mail, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
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
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--background)]">
      {/* Shield Logo */}
      <div className="relative mb-6 shield-animate">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-green-500/20 flex items-center justify-center">
          <Shield className="w-12 h-12 text-blue-500" strokeWidth={1.5} />
          <Lock className="w-5 h-5 text-white absolute" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold mb-2 gradient-text">ALO Shield</h1>
      <p className="text-[var(--muted)] mb-8 text-center">
        Chat & Video 1-1 Bảo Mật Cao
      </p>

      {/* Tab Switcher */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex bg-[var(--card)] rounded-xl p-1">
          <button className="flex-1 py-3 text-center rounded-lg bg-[var(--primary)] text-white font-semibold">
            Đăng Nhập
          </button>
          <Link
            href="/register"
            className="flex-1 py-3 text-center rounded-lg text-[var(--muted)] hover:text-white transition-colors"
          >
            Đăng Ký
          </Link>
        </div>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {successMessage && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-500 text-sm">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Email */}
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]" />
          <input
            type="email"
            placeholder="Email hoặc số điện thoại"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className="w-full pl-12 pr-4 py-4 bg-[var(--card)] rounded-xl"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Nhập mật khẩu"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            className="w-full pl-12 pr-12 py-4 bg-[var(--card)] rounded-xl"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5 text-[var(--muted)]" />
            ) : (
              <Eye className="w-5 h-5 text-[var(--muted)]" />
            )}
          </button>
        </div>

        {/* Forgot Password */}
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-blue-500 hover:underline">
            Quên mật khẩu?
          </Link>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary w-full py-4 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Truy Cập An Toàn
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="w-full max-w-sm flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-sm text-[var(--muted)] uppercase tracking-wider">
          Hoặc đăng nhập bằng
        </span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      {/* Google Login */}
      <GoogleLoginButton />

      {/* E2EE Badge */}
      <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10">
        <Lock className="w-4 h-4 text-green-500" />
        <span className="text-sm text-green-500">Mã hóa Đầu-Cuối (E2EE)</span>
      </div>

      {/* Footer */}
      <div className="mt-8 flex gap-6 text-sm text-[var(--muted)]">
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

