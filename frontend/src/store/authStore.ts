import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  role: "partner" | "guest";
  initials: string;
  avatar_color: string; // tailwind bg class e.g. "bg-blue-600"
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isPartner: boolean;
  isGuest: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isPartner: false,
      isGuest: false,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isPartner: user?.role === "partner",
          isGuest: user?.role === "guest",
        }),
      logout: () =>
        set({ user: null, isAuthenticated: false, isPartner: false, isGuest: false }),
    }),
    {
      name: "sf-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isPartner: state.isPartner,
        isGuest: state.isGuest,
      }),
    }
  )
);
