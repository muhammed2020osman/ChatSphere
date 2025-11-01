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
      const u = await apiRequest<User & { companyId?: number }>("/api/auth/user");
      // Update companyId in localStorage if present
      if (u.companyId) {
        localStorage.setItem('company_id', String(u.companyId));
      }
      setUser(u);
    } catch {
      // If refresh fails, clear token and companyId (might be expired)
      localStorage.removeItem('auth_token');
      localStorage.removeItem('company_id');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<{ id: number; email: string; name: string; companyId: number; token: string }>("/api/auth/login", { 
      method: "POST", 
      body: { email, password } 
    });
    // Save token and companyId to localStorage
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
      if (response.companyId) {
        localStorage.setItem('company_id', String(response.companyId));
      }
      // Set user immediately from response to avoid delay
      setUser({ id: response.id, email: response.email, name: response.name || null, companyId: response.companyId } as User);
    }
    // Refresh to ensure we have the latest user data
    await refresh();
  }, [refresh]);

  const register = useCallback(async (name: string, email: string, password: string, companyId?: number, role?: string) => {
    const response = await apiRequest<{ id: number; email: string; name: string; companyId: number; token: string }>("/api/auth/register", { 
      method: "POST", 
      body: { name, email, password, ...(companyId ? { companyId } : {}), ...(role ? { role } : {}) } 
    });
    // Save token and companyId to localStorage
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
      if (response.companyId) {
        localStorage.setItem('company_id', String(response.companyId));
      }
      // Set user immediately from response to avoid delay
      setUser({ id: response.id, email: response.email, name: response.name || null, companyId: response.companyId } as User);
    }
    // Refresh to ensure we have the latest user data
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await apiRequest("/api/auth/logout", { method: "POST" }); } catch {}
    // Clear token and companyId from localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('company_id');
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


