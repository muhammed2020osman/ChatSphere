import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/queryClient";
import AuthLayout from "@/components/auth/AuthLayout";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Avoid stale user cache on this page as well
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }, []);

  const { register: registerUser } = useAuthContext();
  const normalizeError = (e: any) => {
    const raw = (e && (e.message || e.toString())) || '';
    // Strip leading "<code>: " if present, e.g. "400: {\"error\":...}"
    const cleaned = raw.replace(/^\d+:\s*/,'');
    try {
      const parsed = JSON.parse(cleaned);
      // Prefer detailed server error when available
      if (parsed?.error && parsed?.code) return `${parsed.error} (${parsed.code})`;
      if (parsed?.error) return parsed.error;
      if (parsed?.message && parsed?.code) return `${parsed.message} (${parsed.code})`;
      return parsed?.message || cleaned;
    } catch {
      return cleaned || 'Registration failed. Please check inputs';
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerUser(name, email, password);
      navigate("/");
    } catch (err: any) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="انشئ حسابك للوصول إلى مساحة العمل"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : "Sign Up"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Already have an account? <Link href="/login" className="text-primary">Sign In</Link>
        </p>
      </form>
    </AuthLayout>
  );
}


