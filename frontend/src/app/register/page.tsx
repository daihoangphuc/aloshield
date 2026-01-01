"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, Mail, User, Eye, EyeOff, Loader2, ArrowRight, AlertCircle, Check } from "lucide-react";
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

  // Password strength checker
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthLabels = ["Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"];
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"];

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
    <main className="min-h-screen relative flex flex-col items-center p-6 py-16 overflow-x-hidden bg-[var(--background)]">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--accent)]/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[var(--primary)]/8 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center animate-in">
        {/* Shield Logo Mini */}
        <div className="relative mb-8 shield-animate">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--primary)]/20 flex items-center justify-center border border-white/10 backdrop-blur-xl">
            <Shield className="w-10 h-10 text-[var(--accent)]" strokeWidth={1.5} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--background)] p-1.5 rounded-lg border border-white/10">
              <Lock className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-black mb-3 text-white tracking-tight">
          Tạo <span className="gradient-text">tài khoản mới</span>
        </h1>
        <p className="text-[var(--text-muted)] mb-8 text-center font-medium">
          Tham gia cộng đồng chat bảo mật nhất hiện nay
        </p>

        {/* Auth Card */}
        <div className="w-full card p-8 shadow-2xl">
          {/* Tab Switcher */}
          <div className="flex bg-[var(--background)] rounded-2xl p-1.5 mb-8 border border-[var(--border)]">
            <Link
              href="/login"
              className="flex-1 py-3 text-sm font-bold rounded-xl text-[var(--text-muted)] hover:text-white transition-colors text-center"
            >
              Đăng Nhập
            </Link>
            <button className="flex-1 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] text-white shadow-lg">
              Đăng Ký
            </button>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-2xl flex items-center gap-3 slide-up">
                <AlertCircle className="w-5 h-5 text-[var(--danger)] flex-shrink-0" />
                <span className="text-[var(--danger)] text-sm font-medium">{error}</span>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] ml-1">
                Email
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

            {/* Username & Display Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] ml-1">
                  Username
                </label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
                  <input
                    type="text"
                    placeholder="johndoe"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                    required
                    className="input-field pl-10 text-sm py-3"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] ml-1">
                  Tên hiển thị
                </label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="input-field pl-10 text-sm py-3"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] ml-1">
                Mật khẩu
              </label>
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
              
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-[var(--border)]"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] font-medium text-[var(--text-muted)]">
                    Độ mạnh: <span className={`${passwordStrength >= 3 ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                      {strengthLabels[passwordStrength - 1] || "Rất yếu"}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] ml-1">
                Xác nhận mật khẩu
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className={`input-field pl-12 pr-12 ${
                    formData.confirmPassword && formData.password === formData.confirmPassword 
                      ? "border-[var(--success)] focus:border-[var(--success)]" 
                      : ""
                  }`}
                />
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Check className="w-5 h-5 text-[var(--success)]" />
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-4 mt-4 group"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Khởi Tạo Tài Khoản
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

        {/* Footer */}
        <div className="mt-10 flex gap-8 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em]">
          <a href="#" className="hover:text-white transition-colors">Chính sách</a>
          <a href="#" className="hover:text-white transition-colors">Điều khoản</a>
        </div>
      </div>
    </main>
  );
}
