import { useAuthContext } from "@/contexts/AuthContext";
export function useAuth() {
  const { user, loading } = useAuthContext();
  return { user, isLoading: loading, isAuthenticated: !!user };
}
