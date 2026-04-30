import { create } from "zustand";
import { api } from "../api/client.ts";

interface AuthState {
  user: { id: string; email: string } | null;
  loading: boolean;
  check: () => Promise<void>;
  logout: () => Promise<void>;
}

const DEV_USER = { id: "dev-bypass-user", email: "dev@localhost" };

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  check: async () => {
    if (import.meta.env.VITE_DISABLE_AUTH === "true") {
      set({ user: DEV_USER, loading: false });
      return;
    }
    try {
      const data = await api.getSession();
      set({ user: data?.user ?? null, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    if (import.meta.env.VITE_DISABLE_AUTH === "true") return;
    await api.logout().catch(() => {});
    set({ user: null });
  },
}));
