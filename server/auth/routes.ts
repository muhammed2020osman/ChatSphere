import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ensureAuthUsersTable, createAuthUser, findAuthUserByEmail, findAuthUserById } from './user.model';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

const router = Router();

// Ensure table exists on first import
ensureAuthUsersTable().catch((e) => {
  console.error('Failed to ensure auth_users table:', e);
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const { email, password, name } = parsed.data;
    const existing = await findAuthUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createAuthUser({ email, passwordHash, name });
    req.session.userId = user.id;
    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  } catch (e: any) {
    const message = e?.message || 'Database unavailable';
    // Map common network errors to 503 so client can show clear message
    if (message.includes('ETIMEDOUT') || message.includes('ENETUNREACH') || e?.code === 'DB_UNAVAILABLE') {
      return res.status(503).json({ message: 'Database unavailable. Please try again later.' });
    }
    return res.status(500).json({ message: 'Registration failed' });
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const { email, password } = parsed.data;
    const user = await findAuthUserByEmail(email);
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    req.session.userId = user.id;
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (e: any) {
    const message = e?.message || '';
    if (message.includes('ETIMEDOUT') || message.includes('ENETUNREACH') || e?.code === 'DB_UNAVAILABLE') {
      return res.status(503).json({ message: 'Database unavailable. Please try again later.' });
    }
    return res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
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
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = await findAuthUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
});

export default router;


