import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ensureUsersAuthColumns, createAuthUser, findAuthUserByEmail, findAuthUserById, emailExists } from './user.model';
import { generateToken } from './jwt';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

const router = Router();

// Ensure users auth columns exist on first import
ensureUsersAuthColumns().catch((e) => {
  console.error('Failed to ensure users auth columns:', e);
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  companyId: z.number().optional(), // Optional - can be from tenantResolver
});

router.post('/register', async (req, res) => {
  try {
    await ensureUsersAuthColumns();
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const { email, password, name } = parsed.data;
    
    // Get companyId from request body, tenantResolver, or throw error
    const companyId = parsed.data.companyId || req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required. Provide x-company-id header or companyId in body.' });
    }
    
    // Verify company exists (if companyId is provided)
    if (companyId) {
      const { db } = await import('../db');
      const { companies } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const companyResults = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      
      if (companyResults.length === 0) {
        return res.status(404).json({ error: 'Company not found. Invalid company ID.' });
      }
    }
    
    const exists = await emailExists(email, companyId);
    if (exists) return res.status(409).json({ error: 'Email already in use for this company' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createAuthUser({ email, passwordHash, name, companyId });
    
    // Generate JWT token instead of using session
    const token = generateToken({
      userId: String(user.id),
      email: user.email,
      id: user.id as number,
      companyId: user.companyId,
    });
    
    console.log('Registration successful - Generating JWT token:', {
      userEmail: email,
      userId: user.id,
      companyId: user.companyId,
    });
    
    // Return user data and token (client will store token in localStorage)
    res.status(201).json({ 
      id: user.id, 
      email: user.email, 
      name: user.name,
      companyId: user.companyId,
      token 
    });
  } catch (e: any) {
    const message = e?.message || 'Database unavailable';
    // Log full error for debugging
    console.error('Register error:', { code: e?.code, message: e?.message });
    // Map common network errors to 503 so client can show clear message
    if (message.includes('ETIMEDOUT') || message.includes('ENETUNREACH') || e?.code === 'DB_UNAVAILABLE') {
      return res.status(503).json({ message: 'Database unavailable. Please try again later.' });
    }
    // MySQL duplicate email
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already in use', code: e.code });
    }
    // MySQL NOT NULL violation
    if (e?.code === 'ER_NO_DEFAULT_FOR_FIELD' || e?.code === 'ER_BAD_NULL_ERROR') {
      return res.status(400).json({ error: 'Missing required fields', code: e.code });
    }
    // Bad field (mismatched schema)
    if (e?.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({ message: 'Database schema mismatch', code: e.code, error: e?.message });
    }
    // In development, surface the error code for faster diagnosis
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ message: 'Registration failed', code: e?.code, error: e?.message });
    }
    return res.status(500).json({ message: 'Registration failed' });
  }
});

const loginSchema = z.object({ 
  email: z.string().email(), 
  password: z.string().min(8),
  companyId: z.number().optional(), // Optional - can be from tenantResolver
});
router.post('/login', async (req, res) => {
  try {
    await ensureUsersAuthColumns();
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const { email, password } = parsed.data;
    
    // Get companyId from request body or tenantResolver
    const companyId = parsed.data.companyId || req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required. Provide x-company-id header or companyId in body.' });
    }
    
    const user = await findAuthUserByEmail(email, companyId);
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    
    // Verify user belongs to the requested company
    if (user.companyId !== companyId) {
      return res.status(403).json({ error: 'User does not belong to this company' });
    }
    
    // Generate JWT token instead of using session
    const token = generateToken({
      userId: String(user.id),
      email: user.email,
      id: user.id as number,
      companyId: user.companyId,
    });
    
    console.log('Login successful - Generating JWT token:', {
      userEmail: email,
      userId: user.id,
      companyId: user.companyId,
    });
    
    // Return user data and token (client will store token in localStorage)
    res.json({ 
      id: user.id, 
      email: user.email, 
      name: user.name,
      companyId: user.companyId,
      token 
    });
  } catch (e: any) {
    const message = e?.message || '';
    if (message.includes('ETIMEDOUT') || message.includes('ENETUNREACH') || e?.code === 'DB_UNAVAILABLE') {
      return res.status(503).json({ message: 'Database unavailable. Please try again later.' });
    }
    return res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  const isSecure = process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true';
  const sameSiteValue: 'none' | 'lax' | 'strict' = isSecure ? 'none' : 'lax';
  const cookieOpts = {
    httpOnly: true,
    sameSite: sameSiteValue as const,
    secure: isSecure,
    path: '/',
  };
  req.session.destroy(() => {
    // Clear both possible cookie names
    res.clearCookie('sid', cookieOpts);
    res.clearCookie('connect.sid', cookieOpts);
    res.status(204).end();
  });
});

router.get('/me', async (req, res) => {
  // Support both JWT token and session for backward compatibility
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { verifyToken } = await import('./jwt');
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Unauthorized' });
    const user = await findAuthUserById(payload.userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(user);
  }
  
  // Fallback to session-based auth
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = await findAuthUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
});

// Backwards-compatible alias for clients expecting /user
router.get('/user', async (req, res) => {
  // Support both JWT token and session for backward compatibility
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { verifyToken } = await import('./jwt');
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Unauthorized' });
    const user = await findAuthUserById(payload.userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(user);
  }
  
  // Fallback to session-based auth
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = await findAuthUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
});

export default router;


