import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import mysql from "mysql2/promise";
import mysql2 from "mysql2";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Extend session types
declare module "express-session" {
  interface SessionData {
    passport?: {
      user?: any;
    };
    user?: any;
  }
}

if (!process.env.REPLIT_DOMAINS) {
  console.warn("REPLIT_DOMAINS not set, using local development mode");
}

const getOidcConfig = memoize(
  async () => {
    try {
      return await client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
      );
    } catch (error) {
      console.warn("OIDC discovery failed, using mock config for local development");
      return {
        issuer: { issuer: "https://replit.com/oidc" },
        client_id: "mock-client-id",
        client_secret: "mock-client-secret"
      } as any; // Type assertion for mock config
    }
  },
  { maxAge: 3600 * 1000 }
);

export async function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const MySQLStore = MySQLStoreFactory(session as any);
  // In development, always use in-memory sessions to avoid DB-related crashes
  if (process.env.NODE_ENV === 'development') {
    const store = new session.MemoryStore();
    return session({
      secret: process.env.SESSION_SECRET!,
      name: 'sid',
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: sessionTtl,
      },
    });
  }
  // Ensure session store connects to the selected database
  let dbUrl: URL | null = null;
  try {
    dbUrl = new URL(process.env.DATABASE_URL || "");
  } catch (e) {
    // In development without DATABASE_URL, allow fallback to default connector
  }
  const connectionOptions = dbUrl
    ? {
        host: dbUrl.hostname,
        port: parseInt(dbUrl.port) || 3306,
        user: dbUrl.username,
        password: dbUrl.password,
        database: dbUrl.pathname.slice(1),
        charset: "utf8mb4",
      }
    : undefined;
  // Prefer MySQL-backed session store if DB is reachable; otherwise fallback to MemoryStore
  let store: session.Store;
  if (connectionOptions) {
    try {
      const test = await mysql.createConnection({
        ...connectionOptions,
        connectTimeout: 5000,
      });
      await test.ping();
      await test.end();
      // Use a dedicated table name to avoid clashing with existing tables
      // Use callback-style pool for express-mysql-session compatibility
      const cbPool = mysql2.createPool({
        host: connectionOptions.host,
        port: connectionOptions.port,
        user: connectionOptions.user,
        password: connectionOptions.password,
        database: connectionOptions.database,
        charset: connectionOptions.charset,
        connectionLimit: 10,
      });
      store = new MySQLStore({
        schema: { tableName: "express_sessions" },
        createDatabaseTable: true,
        clearExpired: true,
        expiration: sessionTtl,
      }, cbPool as any);
    } catch (err) {
      console.warn("Session DB unreachable, using in-memory session store for development.");
      store = new session.MemoryStore();
    }
  } else {
    store = new session.MemoryStore();
  }
  return session({
    secret: process.env.SESSION_SECRET!,
    name: 'sid',
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    name: claims["name"] || `${claims["first_name"] || ''} ${claims["last_name"] || ''}`.trim() || null,
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(await getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Only configure OIDC in non-development environments
  if (process.env.NODE_ENV !== 'development') {
    const domains = process.env.REPLIT_DOMAINS?.split(",") || ["localhost:5000"];
    for (const domain of domains) {
      const cleanDomain = domain.trim();
      const strategy = new Strategy(
        {
          name: `replitauth:${cleanDomain}`,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `http://${cleanDomain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
    }
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", async (req, res, next) => {
    // Delegate to OIDC when configured; otherwise require local auth routes
    if (process.env.NODE_ENV !== 'development') {
      return passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    }
    // In development, do not provide mock login; instruct client to use email/password
    return res.status(401).json({ message: 'Use /api/auth/login to authenticate' });
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    // Destroy local session for both dev and production
    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
    req.session.destroy(() => {
      // Clear both possible names just in case
      res.clearCookie('sid', cookieOpts);
      res.clearCookie('connect.sid', cookieOpts);
      res.status(204).end();
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Prefer local email/password session
  if (req.session?.userId) {
    try {
      // Map to a claims-like shape expected by downstream code
      req.user = {
        claims: {
          sub: `auth:${req.session.userId}`,
          email: undefined,
          name: undefined,
          profile_image_url: null,
        },
      } as any;
      return next();
    } catch {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  }

  // Otherwise, fall back to OIDC session (if configured)
  const user = req.user as any;
  if (user?.claims && user.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    if (now <= user.expires_at) return next();
    const refreshToken = user.refresh_token;
    if (!refreshToken) return res.status(401).json({ message: 'Unauthorized' });
    try {
      const cfg = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(cfg, refreshToken);
      updateUserSession(user, tokenResponse);
      return next();
    } catch {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  }
  return res.status(401).json({ message: 'Unauthorized' });
};
