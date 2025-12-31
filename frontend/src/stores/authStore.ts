import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";
import { User } from "@/lib/api";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => {
        // Store userId for E2EE
        if (typeof window !== "undefined") {
          if (user?.id) {
            localStorage.setItem("userId", user.id);
          } else {
            localStorage.removeItem("userId");
          }
        }
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        });
      },

      setLoading: (isLoading) => set({ isLoading }),

      login: (token, user) => {
        Cookies.set("accessToken", token, { expires: 1 / 96 }); // 15 minutes
        // Store userId for E2EE
        if (typeof window !== "undefined" && user?.id) {
          localStorage.setItem("userId", user.id);
        }
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        Cookies.remove("accessToken");
        if (typeof window !== "undefined") {
          localStorage.removeItem("userId");
        }
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }),
    }
  )
);

