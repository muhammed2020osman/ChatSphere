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
      setError('Please enter an invitation code (company ID)');
      return;
    }
    if (!useInvitationCode && !companyName.trim()) {
      setError('Please enter a company name');
      return;
    }
    
    setLoading(true);
    try {
      let companyId: number | undefined;
      
      if (useInvitationCode) {
        // Invitation code is the company ID directly
        const parsedId = parseInt(invitationCode.trim(), 10);
        if (isNaN(parsedId) || parsedId <= 0) {
          setError('Invalid invitation code. Please enter a valid company ID number.');
          setLoading(false);
          return;
        }
        companyId = parsedId;
      } else {
        // Create new company if company name is provided
        try {
          console.log('Creating company with name:', companyName.trim());
          
          const response = await fetch('/api/companies/create-simple', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: companyName.trim() }),
            credentials: 'include',
          });
          
          console.log('Company creation response status:', response.status, response.statusText);
          console.log('Company creation response headers:', Object.fromEntries(response.headers.entries()));
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Company creation failed:', response.status, errorText);
            try {
              const errorJson = JSON.parse(errorText);
              setError(`Failed to create company: ${errorJson.error || errorJson.message || 'Unknown error'}`);
            } catch {
              setError(`Failed to create company: ${response.status} ${response.statusText}`);
            }
            setLoading(false);
            return;
          }
          
          const contentType = response.headers.get('content-type');
          console.log('Response content-type:', contentType);
          
          let newCompany: { id: number; name?: string } | null = null;
          
          // Read response text only once
          const responseText = await response.text();
          console.log('Raw response text:', responseText);
          console.log('Response text length:', responseText.length);
          
          if (!responseText || responseText.trim().length === 0) {
            console.error('Empty response body');
            setError('Failed to create company: Empty response from server');
            setLoading(false);
            return;
          }
          
          if (contentType && contentType.includes('application/json')) {
            try {
              newCompany = JSON.parse(responseText);
              console.log('Parsed company response:', newCompany);
              console.log('Parsed company type check:', {
                hasId: 'id' in (newCompany || {}),
                id: (newCompany as any)?.id,
                idType: typeof (newCompany as any)?.id,
                fullObject: JSON.stringify(newCompany, null, 2),
              });
            } catch (parseError) {
              console.error('Failed to parse JSON response:', parseError);
              console.error('Response text that failed to parse:', responseText);
              setError(`Failed to create company: Invalid JSON response from server (${parseError instanceof Error ? parseError.message : 'unknown error'})`);
              setLoading(false);
              return;
            }
          } else {
            console.error('Unexpected content-type:', contentType);
            console.error('Response text:', responseText);
            setError(`Failed to create company: Unexpected response format (content-type: ${contentType || 'none'})`);
            setLoading(false);
            return;
          }
          
          console.log('Company created response (after parsing):', newCompany);
          
          if (!newCompany) {
            console.error('Company response is null or undefined');
            setError('Failed to create company: No data in response');
            setLoading(false);
            return;
          }
          
          if (!('id' in newCompany)) {
            console.error('Company response missing id property:', Object.keys(newCompany));
            setError('Failed to create company: Response missing company ID');
            setLoading(false);
            return;
          }
          
          if (newCompany.id === undefined || newCompany.id === null) {
            console.error('Company ID is undefined or null:', { 
              newCompany, 
              id: newCompany.id,
              idType: typeof newCompany.id 
            });
            setError('Failed to create company: Company ID is missing in response');
            setLoading(false);
            return;
          }
          
          // Ensure companyId is a number
          const id = typeof newCompany.id === 'string' ? parseInt(newCompany.id, 10) : Number(newCompany.id);
          if (isNaN(id) || id <= 0) {
            console.error('Invalid company ID from response:', { 
              newCompany, 
              id, 
              originalId: newCompany.id,
              idType: typeof newCompany.id 
            });
            setError(`Failed to create company: Invalid company ID in response (got: ${newCompany.id}, type: ${typeof newCompany.id})`);
            setLoading(false);
            return;
          }
          
          companyId = id;
          console.log('Company ID from creation (final):', companyId, 'type:', typeof companyId);
        } catch (createErr: any) {
          console.error('Error creating company (exception):', createErr);
          console.error('Error stack:', createErr?.stack);
          const createError = normalizeError(createErr);
          setError(`Failed to create company: ${createError}`);
          setLoading(false);
          return;
        }
      }
      
      if (!companyId || companyId <= 0) {
        setError('Company ID not found or created. Please try again.');
        setLoading(false);
        return;
      }
      
      // Determine role based on registration type:
      // - If user entered invitation code (company ID): role = 'member'
      // - If user created new company (entered company name): role = 'company_manager'
      const role = useInvitationCode ? 'member' : 'company_manager';
      
      // Register user with the company and role
      await registerUser(name, email, password, companyId, role);
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
        
        {/* Invitation Code (Company ID) or Company Name Field */}
        {useInvitationCode ? (
          <div>
            <label className="block text-sm mb-1">Invitation Code (Company ID) *</label>
            <Input 
              type="number" 
              value={invitationCode} 
              onChange={(e) => setInvitationCode(e.target.value)} 
              placeholder="Enter company ID number"
              min="1"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter the company ID number (invitation code)
            </p>
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
            <p className="text-xs text-muted-foreground mt-1">
              A new company will be created with this name
            </p>
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


