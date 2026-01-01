"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";
import { config } from "@/lib/config";
import Cookies from "js-cookie";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, setLoading } = useAuthStore();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setStatus("loading");
    setErrorMessage("");
    setRetryCount(prev => prev + 1);
  };

  useEffect(() => {
    const handleCallback = async () => {
      // Check for error from URL
      const error = searchParams.get("error");
      if (error) {
        console.error("Auth error:", error, searchParams.get("error_description"));
        setStatus("error");
        setErrorMessage(searchParams.get("error_description") || "Lỗi xác thực");
        return;
      }

      // Check for token from backend (email/password login redirect)
      const token = searchParams.get("token");
      const userId = searchParams.get("userId");

      if (token && userId) {
        Cookies.set("accessToken", token, { expires: 1 / 96 });
        try {
          const response = await fetch(`${config.apiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const user = await response.json();
          login(token, user);
          router.push("/chat");
        } catch (err) {
          console.error("Failed to get user info:", err);
          setStatus("error");
          setErrorMessage("Không thể lấy thông tin người dùng");
        }
        return;
      }

      // Handle Supabase OAuth callback
      try {
        // First check URL hash for tokens (Supabase PKCE flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessTokenFromHash = hashParams.get("access_token");
        const refreshTokenFromHash = hashParams.get("refresh_token");
        
        if (accessTokenFromHash && refreshTokenFromHash) {
          console.log("Found tokens in URL hash, setting session...");
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessTokenFromHash,
            refresh_token: refreshTokenFromHash,
          });

          if (setSessionError) {
            console.error("Set session error:", setSessionError);
            setStatus("error");
            setErrorMessage("Không thể thiết lập phiên đăng nhập");
            return;
          }
          
          // Clear the hash from URL
          window.history.replaceState(null, "", window.location.pathname);
        }

        // Now get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          setStatus("error");
          setErrorMessage("Lỗi lấy phiên đăng nhập: " + sessionError.message);
          return;
        }

        if (session) {
          // Sync user with our backend
          const supabaseUser = session.user;
          console.log("Supabase user:", supabaseUser.email);
          
          try {
            // Call backend to sync/create user
            const response = await fetch(`${config.apiUrl}/auth/supabase-sync`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                supabaseUserId: supabaseUser.id,
                email: supabaseUser.email,
                displayName: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0],
                avatarUrl: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
              }),
            });

            const data = await response.json();
            console.log("Backend sync response:", response.status, data);

            if (response.ok) {
              Cookies.set("accessToken", data.accessToken, { expires: 1 / 96 });
              login(data.accessToken, data.user);
              router.push("/chat");
            } else {
              throw new Error(data.message || "Đồng bộ tài khoản thất bại");
            }
          } catch (err: any) {
            console.error("Backend sync failed:", err);
            setStatus("error");
            setErrorMessage(err.message || "Không thể đồng bộ tài khoản với server");
          }
        } else {
          console.log("No session found");
          setStatus("error");
          setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng thử lại.");
        }
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Lỗi không xác định trong quá trình xác thực");
      }
    };

    handleCallback();
  }, [searchParams, login, router, setLoading, retryCount]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--background)]" suppressHydrationWarning>
        <div className="w-full max-w-md bg-[#111b21] rounded-3xl p-8 border border-white/5 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Đăng nhập thất bại</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6">{errorMessage}</p>
            
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={handleRetry}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Thử lại
              </button>
              <button 
                onClick={() => router.push("/login")}
                className="btn btn-secondary w-full"
              >
                Quay lại đăng nhập
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)]" suppressHydrationWarning>
      <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
      <p className="text-[var(--text-secondary)] font-medium">Đang xác thực...</p>
      <p className="text-[var(--text-muted)] text-sm mt-2">Vui lòng đợi trong giây lát</p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center" suppressHydrationWarning>
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
          <p className="text-[var(--muted)]">Đang tải...</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
