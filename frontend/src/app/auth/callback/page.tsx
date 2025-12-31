"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";
import { config } from "@/lib/config";
import Cookies from "js-cookie";
import { Loader2 } from "lucide-react";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, setLoading } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      // Check for error from URL
      const error = searchParams.get("error");
      if (error) {
        console.error("Auth error:", error, searchParams.get("error_description"));
        router.push(`/?error=${error}`);
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
          router.push("/?error=auth_failed");
        }
        return;
      }

      // Handle Supabase OAuth callback
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          router.push("/?error=session_failed");
          return;
        }

        if (session) {
          // Sync user with our backend
          const supabaseUser = session.user;
          
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
                displayName: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name,
                avatarUrl: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
              }),
            });

            const data = await response.json();

            if (response.ok) {
              Cookies.set("accessToken", data.accessToken, { expires: 1 / 96 });
              login(data.accessToken, data.user);
              router.push("/chat");
            } else {
              throw new Error(data.message || "Sync failed");
            }
          } catch (err) {
            console.error("Backend sync failed:", err);
            router.push("/?error=sync_failed");
          }
        } else {
          // No session, check URL hash for tokens (Supabase implicit flow)
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get("access_token");
          
          if (accessToken) {
            // Set the session manually
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get("refresh_token") || "",
            });

            if (error) {
              console.error("Set session error:", error);
              router.push("/?error=session_failed");
              return;
            }

            // Reload to process with session
            window.location.reload();
          } else {
            router.push("/?error=no_session");
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        router.push("/?error=callback_failed");
      }
    };

    handleCallback();
  }, [searchParams, login, router, setLoading]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
      <p className="text-[var(--muted)]">Đang xác thực...</p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
          <p className="text-[var(--muted)]">Đang tải...</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
