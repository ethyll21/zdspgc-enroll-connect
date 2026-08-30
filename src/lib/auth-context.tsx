import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  auth as localAuth,
  getToken,
  getStoredUser,
  setStoredUser,
  clearToken,
  type LocalUser,
} from "@/integrations/localdb/client";

type Role = "student" | "admin";

interface AuthState {
  user: LocalUser | null;
  roles: Role[];
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, full_name?: string, studentType?: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Bootstrap: restore session from localStorage ──────────────────────────
  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await localAuth.me();
      const freshUser: LocalUser = {
        id:        res.user.id,
        email:     res.user.email,
        role:      (res.user.roles?.includes("admin") ? "admin" : "student") as Role,
        full_name: (res.user as any).full_name ?? "",
        student_type: (res.user as any).student_type ?? "new",
        profile:   (res.user as any).profile ?? null,
      };
      setUser(freshUser);
      setStoredUser(freshUser);
    } catch {
      // Token expired or invalid — clear and require re-login
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Try cached user first for instant render
    const cached = getStoredUser();
    if (cached) setUser(cached);
    refreshUser();
  }, [refreshUser]);

  // ── Sign in ────────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const res = await localAuth.login(email, password);
    setUser(res.user);
  }, []);

  // ── Sign up ────────────────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, full_name?: string, studentType?: string) => {
    const res = await localAuth.register(email, password, full_name, studentType);
    setUser(res.user);
  }, []);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    localAuth.logout();
    setUser(null);
  }, []);

  const roles = user ? ([user.role] as Role[]) : [];

  const value: AuthState = {
    user,
    roles,
    isAdmin: user?.role === "admin",
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
