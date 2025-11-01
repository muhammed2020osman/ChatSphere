import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AuthLayout from "@/components/auth/AuthLayout";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useInvitationCode, setUseInvitationCode] = useState(true); // true = invitation code, false = company name
  const [invitationCode, setInvitationCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Avoid stale user cache on this page as well
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }, []);

  // Auto-redirect when authenticated (backup for GuestOnly component)
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, navigate]);

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
    
    // Validate: either invitation code or company name must be provided
    if (useInvitationCode && !invitationCode.trim()) {
      setError('Please enter an invitation code');
      return;
    }
    if (!useInvitationCode && !companyName.trim()) {
      setError('Please enter a company name');
      return;
    }
    
    setLoading(true);
    try {
      // First, find the company by invitation code or name
      let companyId: number | undefined;
      
      try {
        const company = await apiRequest<{ id: number; name: string }>('/api/companies/find', {
          method: 'POST',
          body: useInvitationCode 
            ? { invitationCode: invitationCode.trim() }
            : { companyName: companyName.trim() }
        });
        companyId = company.id;
      } catch (findErr: any) {
        const findError = normalizeError(findErr);
        setError(`Company not found: ${findError}`);
        setLoading(false);
        return;
      }
      
      if (!companyId) {
        setError('Company ID not found');
        setLoading(false);
        return;
      }
      
      // Register user with the found company
      await registerUser(name, email, password, companyId);
      // Don't navigate manually - GuestOnly component will handle redirect
      // navigate("/");
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
        
        {/* Toggle between invitation code and company name */}
        <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
          <div className="flex items-center gap-2">
            <Switch
              checked={useInvitationCode}
              onCheckedChange={setUseInvitationCode}
              id="invitation-toggle"
            />
            <label htmlFor="invitation-toggle" className="text-sm font-medium cursor-pointer">
              {useInvitationCode ? 'Using Invitation Code' : 'Using Company Name'}
            </label>
          </div>
          <span className="text-xs text-muted-foreground">
            {useInvitationCode ? 'Switch to Company Name' : 'Switch to Invitation Code'}
          </span>
        </div>
        
        {/* Invitation Code or Company Name Field */}
        {useInvitationCode ? (
          <div>
            <label className="block text-sm mb-1">Invitation Code *</label>
            <Input 
              type="text" 
              value={invitationCode} 
              onChange={(e) => setInvitationCode(e.target.value)} 
              placeholder="Enter invitation code"
              required
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm mb-1">Company Name *</label>
            <Input 
              type="text" 
              value={companyName} 
              onChange={(e) => setCompanyName(e.target.value)} 
              placeholder="Enter company name"
              required
            />
          </div>
        )}
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


