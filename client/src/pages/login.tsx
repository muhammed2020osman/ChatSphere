import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/queryClient";
import AuthLayout from "@/components/auth/AuthLayout";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Ensure we don't rely on stale user cache on this page
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    // Do NOT auto-logout here to avoid logging the user out after a successful login
  }, []);

  const { login } = useAuthContext();
  const normalizeError = (e: any) => {
    const raw = (e && (e.message || e.toString())) || '';
    const cleaned = raw.replace(/^\d+:\s*/,'');
    try {
      const parsed = JSON.parse(cleaned);
      return parsed?.message || parsed?.error || cleaned;
    } catch {
      return cleaned || 'Invalid email or password';
    }
  };
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Holla, Welcome Back"
      subtitle="Hey, welcome back to your special place | مرحباً بك مجدداً"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="accent-primary" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember me
          </label>
          <span className="opacity-70">Forgot Password?</span>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : "Sign In"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Don’t have an account? <Link href="/register" className="text-primary">Sign Up</Link>
        </p>
      </form>
    </AuthLayout>
  );
}


