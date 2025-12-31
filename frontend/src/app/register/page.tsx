"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, Mail, User, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { config } from "@/lib/config";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    displayName: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    if (formData.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    if (formData.username.length < 3) {
      setError("Tên người dùng phải có ít nhất 3 ký tự");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${config.apiUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          displayName: formData.displayName || formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Đăng ký thất bại");
      }

      // Redirect to login page
      router.push("/login?registered=true");
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra, vui lòng thử lại");
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
          <Link
            href="/login"
            className="flex-1 py-3 text-center rounded-lg text-[var(--muted)] hover:text-white transition-colors"
          >
            Đăng Nhập
          </Link>
          <button className="flex-1 py-3 text-center rounded-lg bg-[var(--primary)] text-white font-semibold">
            Đăng Ký
          </button>
        </div>
      </div>

      {/* Register Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
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
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className="w-full pl-12 pr-4 py-4 bg-[var(--card)] rounded-xl"
          />
        </div>

        {/* Username */}
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Tên người dùng"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
            required
            className="w-full pl-12 pr-4 py-4 bg-[var(--card)] rounded-xl"
          />
        </div>

        {/* Display Name */}
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Tên hiển thị (tuỳ chọn)"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            className="w-full pl-12 pr-4 py-4 bg-[var(--card)] rounded-xl"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Mật khẩu"
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

        {/* Confirm Password */}
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Xác nhận mật khẩu"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            required
            className="w-full pl-12 pr-4 py-4 bg-[var(--card)] rounded-xl"
          />
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
              Tạo Tài Khoản
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="w-full max-w-sm flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-sm text-[var(--muted)] uppercase tracking-wider">
          Hoặc đăng ký bằng
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

