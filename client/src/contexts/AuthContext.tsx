import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await apiRequest<User>("/api/auth/user");
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    await apiRequest("/api/auth/login", { method: "POST", body: { email, password } });
    await refresh();
  }, [refresh]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    await apiRequest("/api/auth/register", { method: "POST", body: { name, email, password } });
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await apiRequest("/api/auth/logout", { method: "POST" }); } catch {}
    setUser(null);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}


