import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { parse as parseCookie } from "cookie";
import { randomUUID } from "crypto";
import passport from "passport";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getSession } from "./replitAuth";
// Removed Object Storage imports for local development
import { localStorage } from "./localStorage";
import { extractMentions, findUserIdsByUsernames, requireAdmin, requireCompanyManager } from "./utils";
import { analyzeEngineeringDrawing } from "./services/gemini";
import { convertPDFToImage, convertPDFPagesToImages, isPDF } from "./services/pdfConverter";
import { extractPDFText } from "./services/pdfTextExtractor";
import { PDFDocument } from "pdf-lib";
import authRoutes from "./auth/routes";
import { 
  insertChannelSchema, 
  insertMessageSchema, 
  insertDirectMessageSchema,
  insertReactionSchema 
} from "@shared/schema";
import { z } from "zod";

// WebSocket client tracking with channel subscriptions
const clients = new Map<string, { ws: WebSocket; userId: string; channels: Set<string> }>();

// Helper function to extract numeric user ID from "auth:1" format
function getUserIdAsNumber(userId: string): number {
  // If userId is already a number string, parse it
  if (/^\d+$/.test(userId)) {
    return parseInt(userId, 10);
  }
  // If userId is in "auth:1" format, extract the number
  if (userId.startsWith('auth:')) {
    const numericId = userId.replace('auth:', '');
    return parseInt(numericId, 10);
  }
  // Fallback: try to parse as number
  const parsed = parseInt(userId, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid user ID format: ${userId}`);
  }
  return parsed;
}

// Helper function to find WebSocket client by user ID
function findWebSocketClient(userId: number): { ws: WebSocket; userId: string; channels: Set<string> } | null {
  const possibleKeys = [
    `auth:${userId}`,
    userId.toString(),
  ];
  
  for (const key of possibleKeys) {
    const client = clients.get(key);
    if (client) {
      return client;
    }
  }
  
  // Fallback: iterate through all clients
  for (const [clientKey, client] of clients.entries()) {
    const clientUserIdAsNumber = getUserIdAsNumber(client.userId);
    if (clientUserIdAsNumber === userId) {
      return client;
    }
  }
  
  return null;
}

// Helper function to send push notification to a user
async function sendPushNotification(
  userId: number,
  notificationData: {
    type: string;
    fromUserId?: number;
    content: string;
    channelId?: number;
    messageId?: number;
    directMessageId?: number;
    companyId: number;
  }
): Promise<void> {
  try {
    // Convert userId to string format for storage methods
    const userIdString = `auth:${userId}`;
    
    // Get user's push subscriptions
    const subscriptions = await storage.getPushSubscriptions(userIdString);
    
    if (subscriptions.length === 0) {
      // No subscriptions, skip silently
      return;
    }

    // Get sender information
    let senderName = 'Someone';
    if (notificationData.fromUserId) {
      try {
        const sender = await storage.getUser(`auth:${notificationData.fromUserId}`, notificationData.companyId);
        if (sender) {
          senderName = sender.name || sender.email || 'Someone';
        }
      } catch (error) {
        console.error(`Error getting sender info for push notification:`, error);
      }
    }

    // Get channel information if available
    let channelName = '';
    if (notificationData.channelId) {
      try {
        const channel = await storage.getChannel(notificationData.channelId, notificationData.companyId);
        if (channel) {
          channelName = channel.name || '';
        }
      } catch (error) {
        console.error(`Error getting channel info for push notification:`, error);
      }
    }

    // Build notification title and body based on type
    let title = 'New notification';
    let body = '';
    let url = '/';

    switch (notificationData.type) {
      case 'mention':
        title = `${senderName} mentioned you`;
        body = notificationData.content ? notificationData.content.substring(0, 100) : '';
        if (notificationData.channelId && notificationData.messageId) {
          url = `/channel/${notificationData.channelId}?messageId=${notificationData.messageId}`;
        } else if (notificationData.channelId) {
          url = `/channel/${notificationData.channelId}`;
        } else {
          url = '/mentions';
        }
        break;
      
      case 'direct_message':
        title = `${senderName} sent a message`;
        body = notificationData.content ? notificationData.content.substring(0, 100) : '';
        if (notificationData.fromUserId) {
          url = `/dm/${notificationData.fromUserId}`;
        }
        break;
      
      case 'channel_message':
        title = `${senderName} sent a message in #${channelName}`;
        body = notificationData.content ? notificationData.content.substring(0, 100) : '';
        if (notificationData.channelId && notificationData.messageId) {
          url = `/channel/${notificationData.channelId}?messageId=${notificationData.messageId}`;
        } else if (notificationData.channelId) {
          url = `/channel/${notificationData.channelId}`;
        }
        break;
      
      case 'channel_added':
        title = `${senderName} added you to #${channelName}`;
        body = `You've been added to channel #${channelName}`;
        if (notificationData.channelId) {
          url = `/channel/${notificationData.channelId}`;
        }
        break;
      
      default:
        title = 'New notification';
        body = notificationData.content ? notificationData.content.substring(0, 100) : '';
    }

    // Import web-push dynamically
    const webpush = await import('web-push');

    // Get VAPID keys from environment
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured, skipping push notification');
      return;
    }

    // Set VAPID details
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Prepare notification payload
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: {
        url,
        type: notificationData.type,
        notificationId: notificationData.messageId || notificationData.directMessageId,
        channelId: notificationData.channelId,
        fromUserId: notificationData.fromUserId,
      },
    });

    // Send notification to all subscriptions
    const promises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (error: any) {
        // If subscription is invalid, remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`Removing invalid push subscription for user ${userId}`);
          await storage.deletePushSubscription(userIdString, subscription.endpoint);
        } else {
          console.error(`Error sending push notification to subscription:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
    console.log(`Push notification sent to user ${userId} (${subscriptions.length} subscriptions)`);
  } catch (error) {
    // Don't throw - we don't want push notification failures to break the main flow
    console.error(`Error sending push notification to user ${userId}:`, error);
  }
}

// Helper function to create mention notifications
async function createMentionNotifications(
  mentionedUserIds: number[],
  message: any,
  senderUserId: number,
  companyId: number
): Promise<void> {
  console.log('[createMentionNotifications] Called with:', {
    mentionedUserIds,
    mentionedUserIdsLength: mentionedUserIds?.length,
    messageId: message?.id,
    channelId: message?.channelId,
    senderUserId,
    companyId,
  });
  
  if (!mentionedUserIds || mentionedUserIds.length === 0) {
    console.log('[createMentionNotifications] No mentioned user IDs, returning early');
    return;
  }

  console.log(`[createMentionNotifications] Processing ${mentionedUserIds.length} mentioned users`);
  
  for (const mentionedUserId of mentionedUserIds) {
    console.log(`[createMentionNotifications] Processing user ${mentionedUserId}`);
    // Skip if user is mentioning themselves
    if (mentionedUserId === senderUserId) {
      continue;
    }

    try {
      // Ensure we have valid data
      if (!message.id) {
        console.error(`Cannot create notification: message.id is missing`);
        return;
      }
      
      if (!message.channelId) {
        console.error(`Cannot create notification: message.channelId is missing`);
        return;
      }
      
      // Create notification in database only
      await storage.createNotification({
        userId: mentionedUserId,
        companyId,
        type: 'mention',
        messageId: message.id,
        channelId: message.channelId,
        fromUserId: senderUserId,
        content: message.content || '',
        isRead: false,
      });
      
      console.log(`Notification created successfully for user ${mentionedUserId}`);
      
      // Send push notification
      await sendPushNotification(mentionedUserId, {
        type: 'mention',
        fromUserId: senderUserId,
        content: message.content || '',
        channelId: message.channelId,
        messageId: message.id,
        companyId,
      });
    } catch (error: any) {
      console.error(`Error creating notification for user ${mentionedUserId}:`, error);
      console.error(`Error details:`, {
        message: error?.message,
        code: error?.code,
        sqlState: error?.sqlState,
        sqlMessage: error?.sqlMessage,
      });
      // Continue with other notifications even if one fails
    }
  }
}

// Helper to get authenticated userId from WebSocket request
async function getAuthenticatedUserId(req: IncomingMessage): Promise<string | null> {
  const sessionMiddleware = await getSession();
  return new Promise((resolve) => {
    const mockRes = {
      getHeader: () => {},
      setHeader: () => {},
      end: () => {},
    } as any;
    
    sessionMiddleware(req as any, mockRes, () => {
      // Initialize passport on the request
      passport.initialize()(req as any, mockRes, () => {
        passport.session()(req as any, mockRes, () => {
          const user = (req as any).user;
          
          if (user && user.claims && user.claims.sub) {
            resolve(user.claims.sub);
          } else {
            resolve(null);
          }
        });
      });
    });
  });
}

// Configure multer for file upload (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF, PNG, JPG files
    const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Only log rejection errors
      if (process.env.DEBUG_UPLOADS === 'true') {
        console.log('File rejected by multer - invalid type:', file.mimetype);
      }
      cb(new Error('Invalid file type. Only PDF, PNG, and JPG files are allowed.'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Debug middleware for API routes (only in debug mode)
  if (process.env.DEBUG_API_ROUTES === 'true') {
    app.use('/api', (req, res, next) => {
      console.log(`[API Route] ${req.method} ${req.path} - Original URL: ${req.originalUrl}`);
      next();
    });
  }
  
  // Tenant resolver middleware - Must be before auth
  const { tenantResolver } = await import('./middleware/tenantResolver');
  app.use(tenantResolver);

  // Auth middleware
  await setupAuth(app);

  // Local auth routes (email/password session-based)
  app.use('/api/auth', authRoutes);

  // Company routes (no auth required for creation)
  app.post('/api/companies', async (req, res) => {
    try {
      const { name, domain, planType = 'basic', invitationCode, adminEmail, adminPassword, adminName } = req.body;
      
      // Validate required fields
      if (!name || !adminEmail || !adminPassword || !adminName) {
        return res.status(400).json({ error: 'Missing required fields: name, adminEmail, adminPassword, adminName' });
      }

      const { z } = await import('zod');
      const { insertCompanySchema } = await import('@shared/schema');
      
      // Validate company data
      const companyData = { name, domain, planType };
      const companyValidation = insertCompanySchema.safeParse(companyData);
      if (!companyValidation.success) {
        return res.status(400).json({ error: 'Invalid company data', details: companyValidation.error });
      }

      const { db } = await import('./db');
      const { companies } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const bcrypt = await import('bcryptjs');
      const { generateToken } = await import('./auth/jwt');
      const { createAuthUser } = await import('./auth/user.model');

      // Create company using MySQL pool directly for reliable insertId
      const { pool } = await import('./db');
      const mysql = await import('mysql2/promise');
      
      // Check if invitation code already exists (if provided)
      if (invitationCode) {
        const [existing] = await pool.execute<mysql.RowDataPacket[]>(
          'SELECT id FROM companies WHERE invitation_code = ?',
          [invitationCode]
        );
        if (existing.length > 0) {
          return res.status(409).json({ error: 'Invitation code already exists' });
        }
      }
      
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        'INSERT INTO companies (name, domain, plan_type, invitation_code) VALUES (?, ?, ?, ?)',
        [name, domain || null, planType, invitationCode || null]
      );
      const companyId = result.insertId;
      
      if (!companyId) {
        throw new Error('Failed to create company');
      }

      // Create admin user for the company
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      const adminUser = await createAuthUser({
        email: adminEmail,
        passwordHash,
        name: adminName,
        companyId: companyId as number,
      });

      // Set admin role (using existing pool from above)
      await pool.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        ['admin', adminUser.id]
      );

      // Generate JWT token for the admin user
      const token = generateToken({
        userId: String(adminUser.id),
        email: adminUser.email,
        id: adminUser.id as number,
        companyId: adminUser.companyId,
      });

      console.log('Company created successfully:', {
        companyId,
        companyName: name,
        adminEmail,
        adminUserId: adminUser.id,
      });

      res.status(201).json({
        company: {
          id: companyId,
          name,
          domain,
          planType,
        },
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          companyId: adminUser.companyId,
        },
        token,
      });
    } catch (error: any) {
      console.error('Error creating company:', error);
      
      // Handle duplicate company name
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Company name already exists' });
      }
      
      res.status(500).json({ error: 'Failed to create company', message: error?.message });
    }
  });

  // Get company by ID (authenticated)
  app.get('/api/companies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id, 10);
      const userCompanyId = (req.user as any)?.companyId || req.companyId;
      
      if (!companyId || isNaN(companyId)) {
        return res.status(400).json({ error: 'Invalid company ID' });
      }
      
      // Verify user belongs to this company
      if (userCompanyId && companyId !== userCompanyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { db } = await import('./db');
      const { companies } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const results = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }
      
      res.json({
        id: results[0].id,
        name: results[0].name,
        domain: results[0].domain,
        planType: results[0].planType,
      });
    } catch (error: any) {
      console.error('Error fetching company:', error);
      res.status(500).json({ error: 'Failed to fetch company', message: error?.message });
    }
  });

  // Find company by invitation code or name (no auth required)
  app.post('/api/companies/find', async (req, res) => {
    try {
      const { invitationCode, companyName } = req.body;
      
      if (!invitationCode && !companyName) {
        return res.status(400).json({ error: 'Either invitationCode or companyName is required' });
      }

      const { db } = await import('./db');
      const { companies } = await import('@shared/schema');
      const { eq, or } = await import('drizzle-orm');

      let company;
      
      if (invitationCode) {
        // Find by invitation code
        const results = await db
          .select()
          .from(companies)
          .where(eq(companies.invitationCode, invitationCode))
          .limit(1);
        company = results[0];
      } else if (companyName) {
        // Find by company name
        const results = await db
          .select()
          .from(companies)
          .where(eq(companies.name, companyName))
          .limit(1);
        company = results[0];
      }

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      res.json({
        id: company.id,
        name: company.name,
        domain: company.domain,
        planType: company.planType,
      });
    } catch (error: any) {
      console.error('Error finding company:', error);
      res.status(500).json({ error: 'Failed to find company', message: error?.message });
    }
  });

  // Create simple company (only name, returns company ID) - for registration flow
  app.post('/api/companies/create-simple', async (req, res) => {
    // Ensure we send JSON response
    res.type('application/json');
    
    try {
      console.log('=== /api/companies/create-simple called ===');
      console.log('Request URL:', req.url);
      console.log('Request method:', req.method);
      console.log('Request body:', req.body);
      console.log('Request headers:', req.headers);
      
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        console.log('Validation failed: Company name is required');
        return res.status(400).json({ error: 'Company name is required' });
      }
      
      console.log('Creating company with name:', name.trim());

      const { pool } = await import('./db');
      const mysql = await import('mysql2/promise');
      
      // Check if company with same name already exists
      const [existing] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT id FROM companies WHERE name = ? LIMIT 1',
        [name.trim()]
      );
      
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Company with this name already exists' });
      }
      
      // Create company with default values
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        'INSERT INTO companies (name, domain, plan_type) VALUES (?, ?, ?)',
        [name.trim(), null, 'basic']
      );
      
      console.log('Company insert result:', { 
        insertId: result.insertId, 
        affectedRows: result.affectedRows,
        warningCount: result.warningCount 
      });
      
      let companyId = result.insertId;
      
      // If insertId is 0 or undefined, query for the last inserted ID
      if (!companyId || companyId === 0) {
        console.log('insertId is 0, querying LAST_INSERT_ID()...');
        const [lastInsert] = await pool.execute<mysql.RowDataPacket[]>(
          'SELECT LAST_INSERT_ID() as id'
        );
        const lastId = (lastInsert[0] as any)?.id;
        console.log('LAST_INSERT_ID() result:', lastId);
        if (lastId && lastId > 0) {
          companyId = lastId;
        }
      }
      
      // If still no ID, try to find the company by name (as fallback)
      if (!companyId || companyId === 0) {
        console.log('Still no ID, trying to find company by name...');
        const [found] = await pool.execute<mysql.RowDataPacket[]>(
          'SELECT id FROM companies WHERE name = ? ORDER BY id DESC LIMIT 1',
          [name.trim()]
        );
        console.log('Found company by name:', found);
        if (found.length > 0 && found[0].id) {
          companyId = found[0].id;
        }
      }
      
      if (!companyId || companyId === 0) {
        console.error('Failed to get company ID after creation:', { 
          result, 
          insertId: result.insertId,
          name: name.trim()
        });
        return res.status(500).json({ 
          error: 'Failed to create company', 
          message: 'Could not retrieve company ID after creation' 
        });
      }

      // Ensure companyId is a number
      const finalCompanyId = typeof companyId === 'string' ? parseInt(companyId, 10) : Number(companyId);
      
      if (isNaN(finalCompanyId) || finalCompanyId <= 0) {
        console.error('Invalid company ID after conversion:', { companyId, finalCompanyId });
        return res.status(500).json({ 
          error: 'Failed to create company', 
          message: 'Invalid company ID after creation' 
        });
      }

      console.log('Simple company created for registration:', {
        companyId: finalCompanyId,
        companyName: name.trim(),
        insertId: result.insertId,
        finalCompanyIdType: typeof finalCompanyId,
      });

      const responseData = {
        id: finalCompanyId,
        name: name.trim(),
      };
      
      console.log('Sending response:', responseData);
      console.log('Response data type check:', {
        id: responseData.id,
        idType: typeof responseData.id,
        name: responseData.name,
      });

      res.status(201).json(responseData);
      console.log('Response sent successfully');
    } catch (error: any) {
      console.error('Error creating simple company:', error);
      
      // Handle duplicate company name
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Company name already exists' });
      }
      
      res.status(500).json({ error: 'Failed to create company', message: error?.message });
    }
  });

  // Access code verification (no auth required)
  app.post('/api/verify-access-code', async (req, res) => {
    try {
      const { code } = req.body;
      const correctCode = process.env.ACCESS_CODE;

      if (!correctCode) {
        return res.status(500).json({ message: "Access code not configured" });
      }

      if (code === correctCode) {
        res.json({ success: true });
      } else {
        res.status(401).json({ message: "Invalid access code" });
      }
    } catch (error) {
      console.error("Error verifying access code:", error);
      res.status(500).json({ message: "Failed to verify access code" });
    }
  });

  // Serve uploaded files locally - MUST be first
  app.get('/uploads/*', (req, res) => {
    console.log('GET /uploads/* - Request received');
    console.log('Request URL:', req.url);
    console.log('Request params:', req.params);
    try {
      const filePath = (req.params as any)[0] as string;
      const fullPath = path.join(process.cwd(), 'uploads', filePath);
      console.log('File path:', filePath);
      console.log('Full path:', fullPath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.log('File not found:', fullPath);
        return res.status(404).json({ message: 'File not found' });
      }
      
      const ext = filePath.split('.').pop()?.toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === 'png') contentType = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
      else if (ext === 'pdf') contentType = 'application/pdf';
      
      console.log('Serving file:', fullPath, 'with content type:', contentType);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(fullPath);
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(404).json({ message: 'File not found' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // CRITICAL: Set headers to prevent caching and ensure credentials work
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      const userId = req.user.claims.sub;
      console.log('GET /api/auth/user - userId:', userId, 'type:', typeof userId);
      
      // Extract user ID from 'auth:123' format or use directly
      let actualUserId: string = userId;
      if (userId.startsWith('auth:')) {
        actualUserId = userId.substring(5);
      }
      
      // Verify user belongs to the company (if companyId is set)
      const companyId = (req.user as any)?.companyId || req.companyId;
      
      // Try to get user from auth system first (for email/password auth)
      const { findAuthUserById } = await import('./auth/user.model');
      let user: any = await findAuthUserById(actualUserId);
      
      console.log('User from findAuthUserById:', user);
      console.log('User role from findAuthUserById:', (user as any)?.role);
      
      // If not found in auth system, try storage.getUser (for OIDC users)
      if (!user) {
        const storageUser = await storage.getUser(userId, companyId);
        if (storageUser) {
          user = storageUser as any;
        }
      }
      
      if (!user) {
        console.error('User not found for userId:', userId, 'actualUserId:', actualUserId);
        return res.status(404).json({ message: 'User not found' });
      }

      if (companyId && (user as any).companyId && (user as any).companyId !== companyId) {
        console.error('User company mismatch:', {
          userId: user.id,
          userCompanyId: (user as any).companyId,
          requestCompanyId: companyId,
        });
        return res.status(403).json({ message: 'User does not belong to this company' });
      }
      
      console.log('User found:', user.id, user.email);
      
      // Get user role - try multiple sources
      let userRole = (user as any)?.role || null;
      
      // If role is not found, try to get from storage
      if (!userRole) {
        const fullUser = await storage.getUser(user.id, companyId);
        console.log('Full user from storage:', fullUser);
        console.log('Full user role:', (fullUser as any)?.role);
        userRole = (fullUser as any)?.role || null;
      }
      
      // If still not found, query directly from database
      if (!userRole) {
        console.log('Role not found, querying directly from database...');
        const { pool } = await import('./db');
        const mysql = await import('mysql2/promise');
        const [rows] = await pool.execute<mysql.RowDataPacket[]>(
          'SELECT role FROM users WHERE id = ? LIMIT 1',
          [user.id]
        );
        if (rows[0] && rows[0].role) {
          userRole = rows[0].role;
          console.log('Role found from direct query:', userRole);
        }
      }
      
      console.log('Final user role:', userRole);
      
      // Return user data in expected format
      const responseData = {
        id: user.id,
        email: user.email,
        name: user.name || null,
        companyId: (user as any).companyId || companyId,
        role: userRole || 'member', // Default to 'member' if not found
      };
      console.log('API response data:', responseData);
      
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User routes
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      const users = await storage.getAllUsers(companyId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      const user = await storage.getUser(req.params.id, companyId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Admin-only user management routes
  app.patch('/api/users/:id/role', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      requireAdmin(currentUser);
      
      const { role } = req.body;
      if (!role || !['admin', 'member'].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be 'admin' or 'member'" });
      }
      
      const updatedUser = await storage.updateUserRole(req.params.id, role);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user role:", error);
      if (error.message === 'Admin access required') {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      requireAdmin(currentUser);
      
      // Prevent deleting yourself
      if (req.params.id === currentUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      if (error.message === 'Admin access required') {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Channel routes
  app.get('/api/channels', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      
      // Get user to check role
      const user = await storage.getUser(userId, companyId);
      
      let channels: any[];
      if (user?.role === 'company_manager') {
        // Company manager can access all company channels
        channels = await storage.getChannels(companyId);
      } else {
        // Member can only access channels they are a member of
        channels = await storage.getMemberChannels(userId, companyId);
      }
      
      res.json(channels);
    } catch (error) {
      console.error("Error fetching channels:", error);
      res.status(500).json({ message: "Failed to fetch channels" });
    }
  });

  app.get('/api/channels/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      
      // Get current user to check role
      const user = await storage.getUser(userId, companyId);
      
      const channel = await storage.getChannel(req.params.id, companyId);
      
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      
      // Check if user has access (member, public channel, or company_manager/admin)
      if (channel.isPrivate) {
        // Allow company_manager and admin to access all private channels
        const isManager = user && ((user as any).role === 'company_manager' || (user as any).role === 'admin');
        if (!isManager) {
          // For regular users, check if they are a member
          const isMember = await storage.isChannelMember(req.params.id, userId);
          if (!isMember) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }
      
      res.json(channel);
    } catch (error) {
      console.error("Error fetching channel:", error);
      res.status(500).json({ message: "Failed to fetch channel" });
    }
  });

  app.post('/api/channels', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      const userIdAsNumber = getUserIdAsNumber(userId);
      const parsed = insertChannelSchema.parse({
        ...req.body,
        createdBy: userIdAsNumber,
        companyId,
      });
      // Explicitly remove id to ensure it's not passed (even if undefined)
      const { id, ...data } = parsed;
      const channel = await storage.createChannel(data, companyId);
      
      // Auto-join creator to the channel
      await storage.joinChannel(channel.id, userId);
      
      // Only broadcast public channels to all clients
      // Private channels are only visible to members
      if (!channel.isPrivate) {
        broadcastToAll({ type: 'channel_created', channel });
      } else {
        // Private channel - only notify the creator
        const creatorClient = clients.get(userId);
        if (creatorClient?.ws.readyState === WebSocket.OPEN) {
          creatorClient.ws.send(JSON.stringify({ type: 'channel_created', channel }));
        }
      }
      
      res.json(channel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid channel data", errors: error.errors });
      }
      console.error("Error creating channel:", error);
      res.status(500).json({ message: "Failed to create channel" });
    }
  });

  app.post('/api/channels/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      const channel = await storage.getChannel(req.params.id, companyId);
      
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      
      // Only allow joining public channels
      if (channel.isPrivate) {
        return res.status(403).json({ message: "Cannot join private channel - invite required" });
      }
      
      // Check if already a member
      const isMember = await storage.isChannelMember(req.params.id, userId);
      if (isMember) {
        return res.status(400).json({ message: "Already a member of this channel" });
      }
      
      await storage.joinChannel(req.params.id, userId);
      res.json({ message: "Joined channel successfully" });
    } catch (error) {
      console.error("Error joining channel:", error);
      res.status(500).json({ message: "Failed to join channel" });
    }
  });

  // Message routes
  // Update channel endpoint (company_manager only)
  app.put('/api/channels/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }

      // Get user to check role
      const user = await storage.getUser(userId, companyId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user is company_manager
      try {
        requireCompanyManager(user);
      } catch (error: any) {
        return res.status(403).json({ message: error.message || 'Company manager access required' });
      }

      const channelId = req.params.id;
      const channel = await storage.getChannel(channelId, companyId);
      
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }

      const { name, description, isPrivate } = req.body;
      
      // Update channel
      const { db } = await import('./db');
      const { channels } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      await db.update(channels)
        .set({
          name: name || channel.name,
          description: description !== undefined ? description : channel.description,
          isPrivate: isPrivate !== undefined ? isPrivate : channel.isPrivate,
        })
        .where(and(eq(channels.id, parseInt(channelId, 10)), eq(channels.companyId, companyId)));

      // Get updated channel
      const updated = await storage.getChannel(channelId, companyId);
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating channel:", error);
      if (error.message === 'Company manager access required') {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update channel" });
    }
  });

  // Get channel members endpoint (available to channel members)
  app.get('/api/channels/:id/members', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }

      const channelId = req.params.id;
      
      // Get channel to check if it's private
      const channel = await storage.getChannel(channelId, companyId);
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }

      // If channel is private, check if user is a member
      if (channel.isPrivate) {
        const isMember = await storage.isChannelMember(channelId, userId);
        if (!isMember) {
          return res.status(403).json({ message: 'You must be a member of this channel to view members' });
        }
        // For private channels, return only members
        const members = await storage.getChannelMembers(channelId, companyId);
        res.json(members);
      } else {
        // For public channels, return all company users as potential mentions
        const allUsers = await storage.getAllUsers(companyId);
        const members = allUsers.map(user => ({
          user: user,
        }));
        res.json(members);
      }
    } catch (error: any) {
      console.error("Error fetching channel members:", error);
      res.status(500).json({ message: "Failed to fetch channel members" });
    }
  });

  // Add channel member endpoint (company_manager only)
  app.post('/api/channels/:id/members', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }

      // Get user to check role
      const user = await storage.getUser(userId, companyId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user is company_manager
      try {
        requireCompanyManager(user);
      } catch (error: any) {
        return res.status(403).json({ message: error.message || 'Company manager access required' });
      }

      const channelId = req.params.id;
      const { userId: memberUserId } = req.body;
      
      if (!memberUserId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      // Get channel info before adding member
      const channel = await storage.getChannel(channelId, companyId);
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }

      await storage.addChannelMember(channelId, memberUserId, companyId);
      
      // Create notification for the added user
      try {
        const memberUserIdAsNumber = getUserIdAsNumber(memberUserId);
        const userIdAsNumber = getUserIdAsNumber(userId);
        
        await storage.createNotification({
          userId: memberUserIdAsNumber,
          companyId,
          type: 'channel_added',
          channelId: channel.id,
          fromUserId: userIdAsNumber,
          content: `You were added to channel #${channel.name}`,
          isRead: false,
        });
        
        // Send push notification
        await sendPushNotification(memberUserIdAsNumber, {
          type: 'channel_added',
          fromUserId: userIdAsNumber,
          content: `You were added to channel #${channel.name}`,
          channelId: channel.id,
          companyId,
        });
        
        // Send real-time notification to added user
        const addedUserClient = clients.get(memberUserId);
        if (addedUserClient?.ws.readyState === WebSocket.OPEN) {
          addedUserClient.ws.send(JSON.stringify({
            type: 'new_notification',
            notification: {
              type: 'channel_added',
              fromUser: user,
              channel,
              content: `You were added to channel #${channel.name}`,
            },
          }));
        }
      } catch (error) {
        console.error('Error creating channel_added notification:', error);
        // Don't fail the request if notification creation fails
      }
      
      res.status(201).json({ message: 'Member added successfully' });
    } catch (error: any) {
      console.error("Error adding channel member:", error);
      if (error.message === 'Company manager access required') {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes('already a member') || error.message.includes('not found')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to add channel member" });
    }
  });

  // Remove channel member endpoint (company_manager only)
  app.delete('/api/channels/:id/members/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }

      // Get user to check role
      const user = await storage.getUser(userId, companyId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user is company_manager
      try {
        requireCompanyManager(user);
      } catch (error: any) {
        return res.status(403).json({ message: error.message || 'Company manager access required' });
      }

      const channelId = req.params.id;
      const memberUserId = req.params.userId;
      
      await storage.removeChannelMember(channelId, memberUserId, companyId);
      
      res.json({ message: 'Member removed successfully' });
    } catch (error: any) {
      console.error("Error removing channel member:", error);
      if (error.message === 'Company manager access required') {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes('not found')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to remove channel member" });
    }
  });

  app.get('/api/channels/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      const channel = await storage.getChannel(req.params.id, companyId);
      
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      
      // Check if user has access (member or public channel)
      if (channel.isPrivate) {
        const isMember = await storage.isChannelMember(req.params.id, userId);
        if (!isMember) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const messages = await storage.getChannelMessages(req.params.id, companyId, userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      
      // Extract mentionedUserIds from request body
      const mentionedUserIdsFromBody = req.body.mentionedUserIds;
      const mentionedUserIds = Array.isArray(mentionedUserIdsFromBody) 
        ? mentionedUserIdsFromBody 
        : (mentionedUserIdsFromBody ? [mentionedUserIdsFromBody] : []);
      
      const userIdAsNumber = getUserIdAsNumber(userId);
      
      // Parse message data (without mentionedUserIds, as it's not part of message schema)
      const { mentionedUserIds: _mentionedUserIdsFromBody, ...bodyWithoutMentions } = req.body;
      
      const messageData = insertMessageSchema.parse({
        ...bodyWithoutMentions,
        userId: userIdAsNumber,
        companyId,
      });
      
      // Add mentionedUserIds separately (not part of message schema)
      const dataWithMentions = {
        ...messageData,
        mentionedUserIds: mentionedUserIds ? [...mentionedUserIds] : [],
      };
      
      // Verify user is a member of the channel
      if (!messageData.channelId) {
        return res.status(400).json({ message: "Channel ID is required" });
      }
      
      const channel = await storage.getChannel(messageData.channelId.toString(), companyId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      
      const isMember = await storage.isChannelMember(messageData.channelId.toString(), userId);
      if (!isMember && channel.isPrivate) {
        return res.status(403).json({ message: "Access denied - not a member of this channel" });
      }
      
      // Create message
      const message = await storage.createMessage(dataWithMentions, companyId);
      
      // Get mentioned user IDs from database (most reliable source)
      let mentionedUserIdsForNotifications: number[] = [];
      try {
        const messageMentions = await storage.getMessageMentions(message.id);
        console.log('[POST /api/messages] Message mentions from database:', JSON.stringify(messageMentions, null, 2));
        console.log('[POST /api/messages] Message mentions length:', messageMentions?.length);
        
        if (messageMentions && messageMentions.length > 0) {
          // getMessageMentions returns objects with spread mention properties
          // The structure is: { ...mention, user: user }
          mentionedUserIdsForNotifications = messageMentions
            .map(m => {
              // Try different possible property names
              const userId = m.userId || (m as any).mention?.userId || (m as any).user_id;
              console.log('[POST /api/messages] Extracting userId from mention:', { m, userId, keys: Object.keys(m) });
              return userId;
            })
            .filter((id): id is number => typeof id === 'number' && !isNaN(id));
          
          console.log('[POST /api/messages] Extracted userIds from database:', mentionedUserIdsForNotifications);
        } else if (mentionedUserIds && mentionedUserIds.length > 0) {
          // Fallback to request body if database has no mentions
          console.log('[POST /api/messages] No mentions in database, using request body');
          mentionedUserIdsForNotifications = mentionedUserIds
            .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
            .filter(id => !isNaN(id));
          console.log('[POST /api/messages] Extracted userIds from request body:', mentionedUserIdsForNotifications);
        }
      } catch (error) {
        console.error('Error fetching mentions from database:', error);
        // Fallback to request body if database query fails
        if (mentionedUserIds && mentionedUserIds.length > 0) {
          mentionedUserIdsForNotifications = mentionedUserIds
            .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
            .filter(id => !isNaN(id));
          console.log('[POST /api/messages] Using request body as fallback:', mentionedUserIdsForNotifications);
        }
      }
      
      // Get user info for the message
      const user = await storage.getUser(userId, companyId);
      const messageWithUser = { ...message, user };
      
      // Track mentioned user IDs to avoid duplicate notifications
      const mentionedUserIdsSet = new Set<number>();
      
      // Create notifications for mentioned users
      console.log('[POST /api/messages] Preparing to create notifications:', {
        mentionedUserIdsForNotifications,
        mentionedUserIdsForNotificationsLength: mentionedUserIdsForNotifications.length,
        messageId: message.id,
        channelId: message.channelId,
        userIdAsNumber,
        companyId,
      });
      
      if (mentionedUserIdsForNotifications.length > 0) {
        console.log('[POST /api/messages] Calling createMentionNotifications...');
        try {
          await createMentionNotifications(
            mentionedUserIdsForNotifications,
            message,
            userIdAsNumber,
            companyId
          );
          console.log('[POST /api/messages] createMentionNotifications completed successfully');
        } catch (error) {
          console.error('[POST /api/messages] Error in createMentionNotifications:', error);
        }
        
        // Add to set for tracking
        mentionedUserIdsForNotifications.forEach(id => mentionedUserIdsSet.add(id));
      } else {
        console.log('[POST /api/messages] No mentioned users to create notifications for');
      }
      
      // Create notifications for all channel members (excluding sender and mentioned users)
      try {
        const channelMembers = await storage.getChannelMembers(message.channelId!.toString(), companyId);
        const senderUserIdAsNumber = getUserIdAsNumber(userId);
        
        for (const member of channelMembers) {
          const memberUserIdAsNumber = member.userId;
          
          // Skip sender and mentioned users (they already have notifications)
          if (memberUserIdAsNumber === senderUserIdAsNumber || mentionedUserIdsSet.has(memberUserIdAsNumber)) {
            continue;
          }
          
          try {
            // Create notification in database only
            await storage.createNotification({
              userId: memberUserIdAsNumber,
              companyId,
              type: 'channel_message',
              messageId: message.id,
              channelId: message.channelId,
              fromUserId: senderUserIdAsNumber,
              content: message.content || '',
              isRead: false,
            });
            
            // Send push notification
            await sendPushNotification(memberUserIdAsNumber, {
              type: 'channel_message',
              fromUserId: senderUserIdAsNumber,
              content: message.content || '',
              channelId: message.channelId,
              messageId: message.id,
              companyId,
            });
          } catch (error) {
            console.error('Error creating channel_message notification:', error);
          }
        }
      } catch (error) {
        console.error('Error creating channel message notifications:', error);
        // Don't fail the request if notification creation fails
      }
      
      // Broadcast new message only to channel members
      if (message.channelId) {
        broadcastToChannel(message.channelId.toString(), {
          type: 'new_message',
          channelId: message.channelId,
          message: messageWithUser,
        });
      }
      
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Direct message routes
  app.get('/api/direct-messages/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      const otherUserId = req.params.userId;
      
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      
      const messages = await storage.getDirectMessages(currentUserId, otherUserId, companyId);
      
      // Get recipient info for proper display
      const recipient = await storage.getUser(otherUserId, companyId);
      
      // Convert currentUserId to number for comparison
      const currentUserIdNum = getUserIdAsNumber(currentUserId);
      
      const messagesWithUsers = messages.map((msg) => {
        // Determine if this message is from current user or to current user
        const isFromCurrentUser = msg.fromUserId === currentUserIdNum;
        
        return {
          ...msg,
          sender: msg.sender, // Always include sender info
          recipient: isFromCurrentUser ? recipient : msg.sender, // For display purposes
        };
      });
      
      res.json(messagesWithUsers);
    } catch (error) {
      console.error("Error fetching direct messages:", error);
      res.status(500).json({ message: "Failed to fetch direct messages" });
    }
  });

  app.post('/api/direct-messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      
      const userIdAsNumber = getUserIdAsNumber(userId);
      const parsed = insertDirectMessageSchema.parse({
        ...req.body,
        fromUserId: userIdAsNumber,
        companyId: companyId, // Ensure companyId is included
      });
      
      // Explicitly remove id to ensure it's not passed
      const { id, ...data } = parsed;
      
      // Ensure companyId is in data
      if (!data.companyId) {
        data.companyId = companyId;
      }
      
      const dm = await storage.createDirectMessage(data);
      
      // Convert toUserId to number and string formats
      const recipientUserIdAsNumber = typeof data.toUserId === 'string' 
        ? getUserIdAsNumber(data.toUserId) 
        : data.toUserId;
      
      // Convert toUserId to string format for clients.get (e.g., "auth:1")
      const recipientUserIdString = typeof data.toUserId === 'string' 
        ? data.toUserId 
        : `auth:${data.toUserId}`;
      
      // Get user info for the message
      const sender = await storage.getUser(userId, companyId);
      const recipient = await storage.getUser(recipientUserIdString, companyId);
      
      if (!sender) {
        console.error('[POST /api/direct-messages] Sender not found:', userId);
        return res.status(404).json({ message: 'Sender not found' });
      }
      
      if (!recipient) {
        console.error('[POST /api/direct-messages] Recipient not found:', {
          toUserId: data.toUserId,
          recipientUserIdAsNumber,
          recipientUserIdString,
        });
        return res.status(404).json({ message: 'Recipient not found' });
      }
      
      // Create or update notification for the recipient
      try {
        await storage.updateOrCreateDirectMessageNotification({
          userId: recipientUserIdAsNumber,
          companyId,
          type: 'direct_message',
          directMessageId: dm.id,
          fromUserId: userIdAsNumber,
          content: dm.content || '',
          isRead: false,
        });
        
        // Send push notification
        await sendPushNotification(recipientUserIdAsNumber, {
          type: 'direct_message',
          fromUserId: userIdAsNumber,
          content: dm.content || '',
          directMessageId: dm.id,
          companyId,
        });
        
        // Send real-time notification to recipient
        const recipientClient = clients.get(recipientUserIdString);
        if (recipientClient?.ws.readyState === WebSocket.OPEN) {
          recipientClient.ws.send(JSON.stringify({
            type: 'new_notification',
            notification: {
              type: 'direct_message',
              fromUser: sender,
              content: dm.content,
            },
          }));
        }
      } catch (error) {
        console.error('Error creating/updating direct_message notification:', error);
        // Don't fail the request if notification creation fails
      }
      
      // Send to specific users (sender and recipient)
      const senderClient = clients.get(userId);
      const recipientClient = clients.get(recipientUserIdString);
      
      const dmData = JSON.stringify({
        type: 'new_dm',
        dm: { ...dm, sender, recipient },
        toUserId: data.toUserId,
        fromUserId: userId,
      });
      
      if (senderClient?.ws.readyState === WebSocket.OPEN) {
        senderClient.ws.send(dmData);
      }
      if (recipientClient?.ws.readyState === WebSocket.OPEN) {
        recipientClient.ws.send(dmData);
      }
      
      // Return the message with sender and recipient info
      const responseData = {
        ...dm,
        sender: {
          id: sender.id,
          name: sender.name,
          email: sender.email,
          profileImageUrl: sender.profileImageUrl,
        },
        recipient: {
          id: recipient.id,
          name: recipient.name,
          email: recipient.email,
          profileImageUrl: recipient.profileImageUrl,
        },
      };
      
      res.json(responseData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      console.error("Error creating direct message:", error);
      // Log more details in development
      if (process.env.NODE_ENV === 'development') {
        console.error("Error details:", {
          message: (error as any)?.message,
          stack: (error as any)?.stack,
          code: (error as any)?.code,
          sqlState: (error as any)?.sqlState,
          sqlMessage: (error as any)?.sqlMessage,
        });
      }
      res.status(500).json({ 
        message: "Failed to create direct message",
        ...(process.env.NODE_ENV === 'development' && { 
          error: (error as any)?.message,
          code: (error as any)?.code 
        })
      });
    }
  });

  // Search route
  app.get('/api/search/:query', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messages = await storage.searchMessages(req.params.query, userId);
      res.json(messages);
    } catch (error) {
      console.error("Error searching messages:", error);
      res.status(500).json({ message: "Failed to search messages" });
    }
  });

  // Reaction routes
  app.post('/api/reactions', isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    let data: any = null;
    
    try {
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get companyId first (needed for getMessage and reaction schema)
      const companyIdForMessage = (req.user as any)?.companyId || req.companyId;
      if (!companyIdForMessage) {
        return res.status(400).json({ message: "Company ID is required" });
      }
      
      // Get the message directly to verify it exists and get its channel
      const message = await storage.getMessage(req.body.messageId, companyIdForMessage);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found or access denied" });
      }

      // Verify user has access to the channel
      const channel = await storage.getChannel(message.channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      if (channel.isPrivate) {
        const isMember = await storage.isChannelMember(message.channelId, userId);
        if (!isMember) {
          return res.status(403).json({ message: "Access denied - not a member of this channel" });
        }
      }

      // Get companyId from message or user (use message.companyId as it's more reliable)
      const companyId = message.companyId || companyIdForMessage;
      
      const userIdAsNumber = getUserIdAsNumber(userId);
      
      // Parse with companyId included (required by schema)
      const parsed = insertReactionSchema.parse({
        ...req.body,
        userId: userIdAsNumber,
        companyId: typeof companyId === 'string' ? parseInt(companyId, 10) : companyId,
      });
      
      // Explicitly remove id to ensure it's not passed
      const { id, ...parsedData } = parsed;
      data = parsedData;
      
      // reactionData is already correct with companyId
      const reactionData = data;

      const reaction = await storage.addReaction(reactionData);
      if (!reaction) {
        console.error("Failed to create reaction - addReaction returned undefined");
        return res.status(500).json({ message: "Failed to create reaction" });
      }
      
      const user = await storage.getUser(userId, companyId);
      if (!user) {
        console.error("User not found for reaction - userId:", userId, "companyId:", companyId);
        return res.status(404).json({ message: "User not found" });
      }
      const reactionWithUser = { ...reaction, user };

      // Broadcast using server-derived channelId
      broadcastToChannel(message.channelId, {
        type: 'new_reaction',
        messageId: data.messageId,
        channelId: message.channelId,
        reaction: reactionWithUser,
      });

      res.json(reaction);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reaction data", errors: error.errors });
      }
      // Map common DB errors to clearer HTTP responses
      if (error?.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(404).json({ message: "Message not found or access denied" });
      }
      if (error?.code === 'ER_DUP_ENTRY') {
        // Treat duplicate as success (idempotent)
        return res.status(200).json({ ok: true });
      }
      console.error("Error adding reaction:", {
        code: error?.code,
        message: error?.message,
        sqlMessage: error?.sqlMessage,
        stack: error?.stack,
        userId: userId || 'not defined',
        messageId: data?.messageId || req.body?.messageId || 'not defined',
        icon: data?.icon || req.body?.icon || 'not defined',
      });
      res.status(500).json({ message: "Failed to add reaction" });
    }
  });

  app.delete('/api/reactions/:messageId/:icon', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { messageId, icon } = req.params;

      // Get the message directly to verify access
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found or access denied" });
      }

      // Verify user has access to the channel
      const channel = await storage.getChannel(message.channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      if (channel.isPrivate) {
        const isMember = await storage.isChannelMember(message.channelId, userId);
        if (!isMember) {
          return res.status(403).json({ message: "Access denied - not a member of this channel" });
        }
      }

      await storage.removeReaction(messageId, userId, icon);

      // Broadcast using server-derived channelId
      broadcastToChannel(message.channelId, {
        type: 'remove_reaction',
        messageId,
        channelId: message.channelId,
        userId,
        icon,
      });

      res.json({ message: "Reaction removed" });
    } catch (error) {
      console.error("Error removing reaction:", error);
      res.status(500).json({ message: "Failed to remove reaction" });
    }
  });

  app.get('/api/messages/:messageId/reactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { messageId } = req.params;

      // Get the message directly to verify access
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found or access denied" });
      }

      // Verify user has access to the channel
      const channel = await storage.getChannel(message.channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      if (channel.isPrivate) {
        const isMember = await storage.isChannelMember(message.channelId, userId);
        if (!isMember) {
          return res.status(403).json({ message: "Access denied - not a member of this channel" });
        }
      }

      const reactions = await storage.getMessageReactions(messageId);
      res.json(reactions);
    } catch (error) {
      console.error("Error fetching reactions:", error);
      res.status(500).json({ message: "Failed to fetch reactions" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      // Fail-soft to avoid breaking the UI
      res.status(200).json([]);
    }
  });

  app.get('/api/notifications/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      // Fail-soft with zero to keep the UI responsive
      res.json({ count: 0 });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch('/api/notifications/mark-all-read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all as read:", error);
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  });

  // Message editing/deletion routes
  app.patch('/api/messages/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { content } = req.body;

      // Get the message to verify ownership
      const channelMessages = await storage.searchMessages('', userId);
      const message = channelMessages.find(m => m.id === id);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      if (message.userId !== userId) {
        return res.status(403).json({ message: "You can only edit your own messages" });
      }

      // Get mentionedUserIds from request body (array of user IDs)
      const mentionedUserIds = req.body.mentionedUserIds;
      const updatedMessage = await storage.updateMessage(id, content, mentionedUserIds);

      // Broadcast message update
      broadcastToChannel(message.channelId, {
        type: 'message_updated',
        message: updatedMessage,
      });

      res.json(updatedMessage);
    } catch (error) {
      console.error("Error updating message:", error);
      res.status(500).json({ message: "Failed to update message" });
    }
  });

  // Get mentions for a specific message
  app.get('/api/messages/:id/mentions', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }

      const mentions = await storage.getMessageMentions(id);
      console.log(`[GET /api/messages/${id}/mentions] Returning ${mentions.length} mentions:`, mentions);
      res.json(mentions);
    } catch (error: any) {
      console.error("Error fetching message mentions:", error);
      res.status(500).json({ message: "Failed to fetch message mentions" });
    }
  });

  // Get all messages where the current user was mentioned
  app.get('/api/mentions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }

      const userIdAsNumber = getUserIdAsNumber(userId);
      const mentions = await storage.getUserMentions(userIdAsNumber, companyId);
      res.json(mentions);
    } catch (error: any) {
      console.error("Error fetching user mentions:", error);
      res.status(500).json({ message: "Failed to fetch mentions" });
    }
  });

  app.get('/api/mentions/count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }

      const userIdAsNumber = getUserIdAsNumber(userId);
      const count = await storage.getMentionsCount(userIdAsNumber, companyId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching mentions count:", error);
      res.status(500).json({ message: "Failed to fetch mentions count" });
    }
  });

  app.delete('/api/messages/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      // Get the message to verify ownership
      const channelMessages = await storage.searchMessages('', userId);
      const message = channelMessages.find(m => m.id === id);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      if (message.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own messages" });
      }

      await storage.deleteMessage(id);

      // Broadcast message deletion
      broadcastToChannel(message.channelId, {
        type: 'message_deleted',
        messageId: id,
      });

      res.json({ message: "Message deleted" });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Get user threads
  app.get('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messages = await storage.getAllMessages(userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get('/api/messages/threads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companyId = (req.user as any)?.companyId || req.companyId;
      
      // Get all threads (messages with replies) instead of user-specific threads
      console.log("Fetching all threads for companyId:", companyId);
      const threads = await storage.getAllThreads(companyId);
      console.log("Found threads:", threads.length);

      // Ensure each thread has user and channel info for the UI
      const enriched = [] as any[];
      for (const t of threads as any[]) {
        let user = (t as any).user;
        if (!user && t.userId) {
          user = await storage.getUser(t.userId, companyId);
        }
        let channelInfo = (t as any).channel;
        if (!channelInfo && t.channelId) {
          const ch = await storage.getChannel(t.channelId, companyId);
          if (ch) channelInfo = { id: ch.id, name: ch.name };
        }
        enriched.push({ ...t, user, channel: channelInfo, replyCount: (t as any).replyCount ?? 0 });
      }

      console.log("Returning enriched threads:", enriched.length);
      res.json(enriched);
    } catch (error) {
      // Fail-soft to avoid breaking the Threads page
      console.error("Error fetching threads:", {
        code: (error as any)?.code,
        message: (error as any)?.message,
        sqlMessage: (error as any)?.sqlMessage,
        stack: (error as any)?.stack,
      });
      res.status(200).json([]);
    }
  });

  app.get('/api/messages/threads/count', isAuthenticated, async (req: any, res) => {
    try {
      const companyId = (req.user as any)?.companyId || req.companyId;
      const count = await storage.getThreadsCount(companyId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching threads count:", error);
      res.status(500).json({ message: "Failed to fetch threads count" });
    }
  });

  // Disciplines routes
  // Removed duplicate disciplines endpoint - using the one below

  // Add disciplines endpoint
  app.post('/api/disciplines', isAuthenticated, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }
      
      const discipline = await storage.createDiscipline({ name, description });
      res.json(discipline);
    } catch (error) {
      console.error("Error creating discipline:", error);
      res.status(500).json({ message: "Failed to create discipline" });
    }
  });

  // Floors routes
  // Removed duplicate floors endpoint - using the one below

  // Drawings routes
  app.get('/api/drawings', isAuthenticated, async (req: any, res) => {
    try {
      const { page = 1, limit = 30 } = req.query;
      const result = await storage.getDrawings(parseInt(page), parseInt(limit));
      res.json(result);
    } catch (error) {
      console.error("Error fetching drawings:", error);
      res.status(500).json({ message: "Failed to fetch drawings" });
    }
  });

  // Starred messages routes
  app.post('/api/messages/:id/star', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      // Get message and verify access
      const message = await storage.getMessage(id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Verify user has access to the channel
      if (!message.channelId) {
        return res.status(400).json({ message: "Message has no channel ID" });
      }
      
      const channel = await storage.getChannel(message.channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      if (channel.isPrivate) {
        const isMember = await storage.isChannelMember(message.channelId, userId);
        if (!isMember) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      // Check if already starred
      const isStarred = await storage.isMessageStarred(id, userId);
      
      if (isStarred) {
        // If already starred, unstar it
        await storage.unstarMessage(id, userId);
        res.json({ isStarred: false, message: "Message unstarred" });
      } else {
        // If not starred, star it
        const starred = await storage.starMessage(id, userId);
        res.json({ isStarred: true, ...starred });
      }
    } catch (error: any) {
      console.error("Error toggling star:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      res.status(500).json({ 
        message: "Failed to toggle star",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.delete('/api/messages/:id/star', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      await storage.unstarMessage(id, userId);
      res.json({ message: "Message unstarred" });
    } catch (error) {
      console.error("Error unstarring message:", error);
      res.status(500).json({ message: "Failed to unstar message" });
    }
  });

  app.get('/api/messages/:id/starred', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      // Get message and verify access
      const message = await storage.getMessage(id);
      if (!message) {
        return res.json({ isStarred: false });
      }

      // Verify user has access to the channel
      if (!message.channelId) {
        return res.status(400).json({ message: "Message has no channel ID" });
      }
      
      const channel = await storage.getChannel(message.channelId);
      if (!channel) {
        return res.json({ isStarred: false });
      }

      if (channel.isPrivate) {
        const isMember = await storage.isChannelMember(message.channelId, userId);
        if (!isMember) {
          return res.json({ isStarred: false });
        }
      }
      
      const isStarred = await storage.isMessageStarred(id, userId);
      res.json({ isStarred });
    } catch (error) {
      console.error("Error checking starred status:", error);
      res.status(500).json({ message: "Failed to check starred status" });
    }
  });

  app.get('/api/starred', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const starred = await storage.getUserStarredMessages(userId);
      res.json(starred);
    } catch (error) {
      console.error("Error fetching starred messages:", error);
      res.status(500).json({ message: "Failed to fetch starred messages" });
    }
  });

  app.get('/api/starred/count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getStarredMessagesCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching starred messages count:", error);
      res.status(500).json({ message: "Failed to fetch starred messages count" });
    }
  });

  // Object storage routes - for file uploads in messages
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    console.log('GET /objects/:objectPath - Request received');
    console.log('Request URL:', req.url);
    console.log('Object path:', req.params.objectPath);
    // For local development, serve files directly
    try {
      const objectPath = req.params.objectPath;
      const filePath = objectPath.replace('/uploads/', '');
      const buffer = await localStorage.downloadFile(filePath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(buffer);
    } catch (error) {
      console.error("Error serving file:", error);
      if (error instanceof Error && error.message.includes('not found')) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    // For local development, return a mock upload URL
    res.json({ uploadURL: "/api/upload" });
  });

  // File upload endpoint
  app.put("/api/upload", isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const file = req.file;
      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop() || 'bin';
      const uniqueFileName = `${userId}_${timestamp}.${fileExtension}`;
      const filePath = uniqueFileName; // Don't include 'uploads/' here as localStorage.uploadFile adds it
      
      // Upload file to local storage
      const fileUrl = await localStorage.uploadFile(filePath, file.buffer, file.mimetype);
      
      res.json({
        success: true,
        fileUrl: fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.put("/api/attachments", isAuthenticated, async (req: any, res) => {
    if (!req.body.attachmentURL || !req.body.fileName) {
      return res.status(400).json({ error: "attachmentURL and fileName are required" });
    }

    const userId = req.user.claims.sub;

    try {
      // For local development, return the attachment URL as is
      res.status(200).json({
        objectPath: req.body.attachmentURL,
        fileName: req.body.fileName,
      });
    } catch (error) {
      console.error("Error setting attachment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server setup
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    verifyClient: (info, callback) => {
      // This would ideally verify the session, but we'll do it in the auth message
      callback(true);
    }
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    // Authenticate via session
    const authenticatedUserId = await getAuthenticatedUserId(req);
    
    if (!authenticatedUserId) {
      ws.close(1008, 'Unauthorized - no valid session');
      return;
    }
    
    const userId = authenticatedUserId;
    let isAuthenticated = true;

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth') {
          // User is already authenticated via session
          // Just initialize their channel subscriptions
          if (userId) {
            // Verify user still exists in database
            const user = await storage.getUser(userId);
            if (!user) {
              ws.close(1008, 'Invalid user');
              return;
            }
            
            // Get user's accessible channels
            const userChannels = await storage.getUserChannels(userId);
            const channelIds = new Set(userChannels.map(c => c.id));
            
            clients.set(userId, { ws, userId, channels: channelIds });
            await storage.updateUserOnlineStatus(userId, true);
            
            // Broadcast user online status to all
            broadcastToAll({
              type: 'user_status',
              userId,
              isOnline: true,
            });
          }
        } else if (message.type === 'subscribe_channel') {
          // User wants to subscribe to a channel (after joining)
          if (!isAuthenticated || !userId) {
            return;
          }
          
          if (message.channelId) {
            const isMember = await storage.isChannelMember(message.channelId, userId);
            const channel = await storage.getChannel(message.channelId);
            
            if (isMember || (channel && !channel.isPrivate)) {
              const client = clients.get(userId);
              if (client) {
                client.channels.add(message.channelId);
              }
            }
          }
        } else if (message.type === 'typing') {
          if (!isAuthenticated || !userId) {
            return;
          }
          
          // Broadcast typing indicator only to channel members
          if (message.channelId) {
            broadcastToChannel(message.channelId, {
              type: 'typing',
              channelId: message.channelId,
              userId: userId, // Use authenticated userId, not client-supplied
              userName: message.userName,
            });
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', async () => {
      if (userId) {
        clients.delete(userId);
        await storage.updateUserOnlineStatus(userId, false);
        
        // Broadcast user offline status to all
        broadcastToAll({
          type: 'user_status',
          userId,
          isOnline: false,
        });
      }
    });
  });

  function broadcastToChannel(channelId: string, message: any) {
    const data = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN && client.channels.has(channelId)) {
        client.ws.send(data);
      }
    });
  }

  function broadcastToAll(message: any) {
    const data = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    });
  }

// Drawings routes - Public reference data endpoints (auth required)
app.get('/api/disciplines', isAuthenticated, async (req, res) => {
  try {
    const disciplines = await storage.getDisciplines();
    res.json(disciplines);
  } catch (error) {
    console.error("Error fetching disciplines:", error);
    res.status(500).json({ 
      message: "Failed to fetch disciplines from database",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/api/floors', isAuthenticated, async (req, res) => {
  try {
    const floors = await storage.getFloors();
    res.json(floors);
  } catch (error) {
    console.error("Error fetching floors:", error);
    res.status(500).json({ 
      message: "Failed to fetch floors from database",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

  app.get('/api/drawings', isAuthenticated, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;
      
      const result = await storage.getDrawings(page, limit);
      res.json(result);
    } catch (error) {
      console.error("Error fetching drawings:", error);
      res.status(500).json({ message: "Failed to fetch drawings" });
    }
  });

  app.get('/api/drawings/:id', isAuthenticated, async (req, res) => {
    try {
      const drawing = await storage.getDrawing(req.params.id);
      if (!drawing) {
        return res.status(404).json({ message: "Drawing not found" });
      }
      res.json(drawing);
    } catch (error) {
      console.error("Error fetching drawing:", error);
      res.status(500).json({ message: "Failed to fetch drawing" });
    }
  });

  app.post('/api/drawings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      // Map drawingNo to sheetNo if provided (for backwards compatibility)
      const userIdAsNumber = getUserIdAsNumber(userId);
      const { id, drawingNo, title, sheetNo, ...rest } = req.body;
      const drawingData = {
        name: title || sheetNo || drawingNo || rest.data?.title || rest.name, // Use title as name, fallback to sheetNo or drawingNo
        description: rest.description || '',
        data: {
          sheetNo: sheetNo || drawingNo || rest.data?.sheetNo, // Store sheetNo in data
          title: title || sheetNo || drawingNo || rest.data?.title || rest.name,
          disciplineId: rest.disciplineId || rest.data?.disciplineId,
          floorId: rest.floorId || rest.data?.floorId,
          packageName: rest.packageName || rest.data?.packageName,
          ...rest.data || {},
        },
        createdBy: userIdAsNumber,
      };
      
      // Validate required fields
      if (!drawingData.data.sheetNo) {
        return res.status(400).json({ message: "sheetNo is required" });
      }
      
      // Check if drawing with this sheetNo already exists
      const existingDrawing = await storage.getDrawingBySheetNo(drawingData.data.sheetNo);
      
      if (existingDrawing) {
        // If it exists without revisions (draft), reuse it
        const revisions = await storage.getDrawingRevisions(existingDrawing.id);
        if (revisions.length === 0) {
          console.log(`Reusing existing draft drawing with sheet_no: ${drawingData.data.sheetNo}`);
          return res.json(existingDrawing);
        } else {
          // If it has revisions, it's already uploaded - return error
          return res.status(409).json({ 
            message: "مخطط بهذا الرقم موجود بالفعل",
            existingDrawingId: existingDrawing.id 
          });
        }
      }
      
      const drawing = await storage.createDrawing(drawingData);
      res.json(drawing);
    } catch (error) {
      console.error("Error creating drawing:", error);
      res.status(500).json({ message: "Failed to create drawing" });
    }
  });

  app.get('/api/drawings/:id/revisions', isAuthenticated, async (req, res) => {
    try {
      const revisions = await storage.getDrawingRevisions(req.params.id);
      // Debug: Log revisions to check fileType
      console.log('[API] Revisions for drawing', req.params.id, ':', revisions.map(r => ({
        id: r.id,
        fileType: r.fileType,
        fileName: r.fileName,
        fileUrl: r.fileUrl
      })));
      res.json(revisions);
    } catch (error) {
      console.error("Error fetching revisions:", error);
      res.status(500).json({ message: "Failed to fetch revisions" });
    }
  });

  app.post('/api/drawings/:id/revisions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userIdAsNumber = getUserIdAsNumber(userId);
      const { id, ...bodyWithoutId } = req.body;
      const revisionData = {
        ...bodyWithoutId,
        drawingId: parseInt(req.params.id, 10),
        createdBy: userIdAsNumber,
        version: req.body.version || req.body.revisionNo || '1.0', // Use version if provided, fallback to revisionNo
        changes: req.body.changes || {}, // Add changes field
      };
      const revision = await storage.createDrawingRevision(revisionData);
      res.json(revision);
    } catch (error) {
      console.error("Error creating revision:", error);
      res.status(500).json({ message: "Failed to create revision" });
    }
  });

  app.patch('/api/revisions/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { status, reviewNotes } = req.body;
      
      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'approved' or 'rejected'" });
      }
      
      const revision = await storage.updateRevisionStatus(
        req.params.id,
        status,
        userId,
        reviewNotes
      );
      res.json(revision);
    } catch (error) {
      console.error("Error updating revision status:", error);
      res.status(500).json({ message: "Failed to update revision status" });
    }
  });

  // Save annotations and merge with PDF
  app.post('/api/drawings/annotations/save', isAuthenticated, upload.array('annotations'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userIdAsNumber = getUserIdAsNumber(userId);
      const { revisionId, drawingId } = req.body;

      if (!revisionId || !drawingId) {
        return res.status(400).json({ message: "revisionId and drawingId are required" });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No annotation images provided" });
      }

      // Get the revision to find the original PDF
      const revisions = await storage.getDrawingRevisions(drawingId);
      const revision = revisions.find((r: any) => r.id.toString() === revisionId.toString());

      if (!revision) {
        return res.status(404).json({ message: "Revision not found" });
      }

      if (!revision.fileUrl || revision.fileType !== 'application/pdf') {
        return res.status(400).json({ message: "Revision must be a PDF file" });
      }

      // Download the original PDF
      const pdfPath = revision.fileUrl.replace('http://localhost:5000/uploads/', '');
      const fullPdfPath = path.join(process.cwd(), 'uploads', pdfPath);
      
      if (!fs.existsSync(fullPdfPath)) {
        return res.status(404).json({ message: "Original PDF file not found" });
      }

      const pdfBytes = fs.readFileSync(fullPdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      // Load annotation images and embed them into PDF pages
      // Sort files by name to ensure correct page order (annotation-page-1.png, annotation-page-2.png, etc.)
      const sortedFiles = (req.files as Express.Multer.File[]).sort((a, b) => {
        const pageNumA = parseInt(a.originalname.match(/annotation-page-(\d+)/)?.[1] || '0', 10);
        const pageNumB = parseInt(b.originalname.match(/annotation-page-(\d+)/)?.[1] || '0', 10);
        return pageNumA - pageNumB;
      });

      console.log(`[API] Processing ${sortedFiles.length} annotation images for ${pages.length} PDF pages`);

      // Embed annotations for each page
      for (let i = 0; i < Math.min(sortedFiles.length, pages.length); i++) {
        const annotationFile = sortedFiles[i];
        const pageIndex = i; // Page index (0-based)
        
        try {
          const annotationImage = await pdfDoc.embedPng(annotationFile.buffer);
          const page = pages[pageIndex];
          const { width, height } = page.getSize();
          
          // Embed the annotation image at full page size
          page.drawImage(annotationImage, {
            x: 0,
            y: 0,
            width: width,
            height: height,
            opacity: 1.0, // Full opacity for annotations
          });
          
          console.log(`[API] Embedded annotations for page ${pageIndex + 1}`);
        } catch (error) {
          console.error(`[API] Error embedding annotations for page ${pageIndex + 1}:`, error);
          // Continue with other pages even if one fails
        }
      }

      // If there are more pages than annotation images, leave them as-is (no annotations)
      if (pages.length > sortedFiles.length) {
        console.log(`[API] ${pages.length - sortedFiles.length} pages will remain without annotations`);
      }

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const timestamp = Date.now();
      const fileName = `drawing_${drawingId}_revision_${revisionId}_annotated_${timestamp}.pdf`;
      const savedPath = path.join(process.cwd(), 'uploads', 'drawings', fileName);
      
      // Ensure directory exists
      const dir = path.dirname(savedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(savedPath, modifiedPdfBytes);

      // Upload to storage and get URL
      const relativePath = `drawings/${fileName}`;
      const fileUrl = await localStorage.uploadFile(relativePath, modifiedPdfBytes, 'application/pdf');

      // Create a new revision with the annotated PDF
      const existingRevisions = await storage.getDrawingRevisions(drawingId);
      const revisionCount = existingRevisions.length + 1;
      const uniqueId = randomUUID().split('-')[0];
      const revisionNo = `R${revisionCount}_${uniqueId}`;

      const revisionData = {
        drawingId: parseInt(drawingId, 10),
        version: revisionNo,
        changes: { annotations: true },
        status: 'draft',
        fileUrl: fileUrl,
        thumbnailUrl: fileUrl, // Use PDF as thumbnail for now
        fileName: fileName,
        fileType: 'application/pdf',
        fileSize: modifiedPdfBytes.length.toString(),
        aiExtractedData: null,
        uploadedBy: userIdAsNumber,
        uploadMethod: 'annotations' as const,
      };

      const newRevision = await storage.createDrawingRevision(revisionData);

      res.json({
        success: true,
        revision: newRevision,
        fileUrl: fileUrl,
      });
    } catch (error) {
      console.error("Error saving annotations:", error);
      res.status(500).json({ message: "Failed to save annotations", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Upload and analyze drawing file with multi-page PDF support
  app.post('/api/drawings/:id/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const drawingId = req.params.id;
      let { revisionNo } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Verify drawing exists
      const drawing = await storage.getDrawing(drawingId);
      if (!drawing) {
        return res.status(404).json({ message: "Drawing not found" });
      }

      // Auto-generate revision number if not provided
      if (!revisionNo) {
        const existingRevisions = await storage.getDrawingRevisions(drawingId);
        const revisionCount = existingRevisions.length + 1;
        // Use randomUUID() to ensure uniqueness even in concurrent scenarios
        const uniqueId = randomUUID().split('-')[0]; // First segment of UUID (8 chars)
        revisionNo = `R${revisionCount}_${uniqueId}`;
        console.log(`Auto-generated revision number: ${revisionNo}`);
      }

      const file = req.file;
      const fileName = file.originalname;
      let fileType = file.mimetype;
      const fileSize = file.size.toString();
      let fileBuffer = file.buffer;

      // Setup local storage for development
      const timestamp = Date.now();

      // Handle PDF files - multi-page support
      let isPdfFile = false;
      let pdfUrl = '';
      let pageResults: any[] = [];
      // No text extraction - file kept as-is
      
      if (fileType === 'application/pdf' || isPDF(fileBuffer)) {
        console.log('PDF detected - saving as-is without any processing...');
        isPdfFile = true;
        
        try {
          // Simply save PDF file without any processing or analysis
          const pdfFileName = `${drawingId}_${revisionNo}_${timestamp}.pdf`;
          const pdfPath = `drawings/${pdfFileName}`;
          
          pdfUrl = await localStorage.uploadFile(pdfPath, fileBuffer, 'application/pdf');
          console.log('PDF saved successfully without processing');
          
          // No text extraction, no AI analysis, no conversion - PDF kept as-is
          
        } catch (pdfError) {
          console.error('Failed to save PDF:', pdfError);
          return res.status(400).json({ 
            message: "Failed to save PDF file. Please ensure it's a valid PDF." 
          });
        }
      } else {
        // Single image file (PNG/JPG)
        console.log('Single image file detected - saving as-is without processing');
        
        // No AI analysis - file kept as-is
        // Create single page result without AI data
        pageResults.push({
          pageNumber: 1,
          imageUrl: '', // Will be set after upload
          aiExtractedData: null,
        });
      }

      // Upload main thumbnail image locally
      // For PDFs: use PDF itself as thumbnail, for images: upload the image
      let thumbnailUrl = '';
      if (isPdfFile) {
        // For PDFs, use the PDF URL as thumbnail (or we could extract first page later)
        thumbnailUrl = pdfUrl;
      } else {
        const fileExtension = fileName.split('.').pop();
        const uniqueFileName = `${drawingId}_${revisionNo}_${timestamp}.${fileExtension}`;
        const imagePath = `drawings/${uniqueFileName}`;
        thumbnailUrl = await localStorage.uploadFile(imagePath, fileBuffer, fileType);
      }

      // Create drawing revision
      const userIdAsNumber = getUserIdAsNumber(userId);
      const revisionData = {
        drawingId: parseInt(drawingId, 10),
        revisionNo,
        version: revisionNo, // Map revisionNo to version
        changes: {}, // Add changes field
        createdBy: userIdAsNumber,
        status: 'draft' as const,
        fileUrl: isPdfFile ? pdfUrl : thumbnailUrl, // PDF URL or image URL
        thumbnailUrl,
        fileName,
        fileType: isPdfFile ? 'application/pdf' : fileType,
        fileSize,
        aiExtractedData: null, // No analysis - file kept as-is
        uploadedBy: userIdAsNumber,
        uploadMethod: 'ai' as const, // Mark as AI upload method
      };

      const revision = await storage.createDrawingRevision(revisionData);
      
      // Create drawing pages in database (only for image files, not PDFs)
      // PDFs are kept as single PDF file, no separate pages stored
      if (pageResults.length > 0 && !isPdfFile) {
        console.log(`Creating ${pageResults.length} drawing pages in database...`);
        for (const pageData of pageResults) {
          // Update image URL for single image uploads
          pageData.imageUrl = thumbnailUrl;
          
          await storage.createDrawingPage({
            revisionId: revision.id,
            pageNumber: pageData.pageNumber.toString(),
            imageUrl: pageData.imageUrl,
            thumbnailUrl: pageData.imageUrl, // Same as image for now
            extractedText: null, // No text extraction - file kept as-is
            extractedMetadata: null, // No metadata extraction - file kept as-is
            aiExtractedData: pageData.aiExtractedData, // No AI analysis
            width: pageData.width || null,
            height: pageData.height || null,
          });
        }
        console.log('All pages created successfully');
      } else if (isPdfFile) {
        console.log('PDF file - no drawing pages created (PDF kept as single file)');
      }
      
      // No AI analysis - file kept as-is
      const aiAnalysis = null;

      // For PDFs, we don't know page count without reading the file
      // Set to 1 as default (can be updated later if needed)
      const pageCount = isPdfFile ? 1 : pageResults.length;

      res.json({
        drawingId: drawing.id,
        revisionId: revision.id,
        pageCount: pageCount,
        extractedText: {
          fullText: "",
          metadata: {
            sheetNumbers: [],
            roomNames: [],
            dimensions: [],
          },
        },
        aiAnalysis: null,
      });
    } catch (error: any) {
      console.error("Error uploading drawing:", error);
      
      // Check for duplicate sheet number error
      if (error?.code === '23505' && error?.constraint === 'drawings_sheet_no_unique') {
        return res.status(409).json({ 
          message: "رقم المخطط موجود بالفعل. الرجاء استخدام رقم مختلف أو تحديث المخطط الموجود.",
          code: "DUPLICATE_SHEET_NUMBER"
        });
      }
      
      res.status(500).json({ message: "فشل رفع المخطط. الرجاء المحاولة مرة أخرى." });
    }
  });

  // Manual upload endpoint (without AI processing)
  app.post('/api/drawings/upload-manual', isAuthenticated, upload.single('file'), async (req: any, res) => {
    console.log('POST /api/drawings/upload-manual - Request received');
    console.log('File:', req.file);
    console.log('Body:', req.body);
    try {
      const userId = req.user.claims.sub;
      const { sheetNo, title, disciplineId, floorId, versionType, parentDrawingId, revisionNotes } = req.body;
      console.log('Request body:', req.body);

      // Validation: Ensure file exists
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Validation: Ensure file is PDF
      const file = req.file;
      const isPdfFile = file.mimetype === 'application/pdf' || isPDF(file.buffer);
      if (!isPdfFile) {
        return res.status(400).json({ message: "Invalid file type. Only PDF files are allowed for manual upload." });
      }

      // Validation: Required fields
      if (!sheetNo || !title || !disciplineId || !versionType) {
        return res.status(400).json({ message: "Missing required fields: sheetNo, title, disciplineId, versionType" });
      }

      if (!['new', 'update'].includes(versionType)) {
        return res.status(400).json({ message: "Invalid versionType. Must be 'new' or 'update'" });
      }

      if (versionType === 'update' && !parentDrawingId) {
        return res.status(400).json({ message: "parentDrawingId is required when versionType is 'update'" });
      }

      let drawingId: string;

      // Get companyId from request
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }

      // Drawing Creation/Selection based on versionType
      console.log('Version type:', versionType);
      if (versionType === 'new') {
        // Create new drawing
        const userIdAsNumber = getUserIdAsNumber(userId);
        // Parse disciplineId and floorId to integers (they come as strings from FormData)
        const disciplineIdInt = parseInt(disciplineId, 10);
        const floorIdInt = floorId ? parseInt(floorId, 10) : null;
        
        if (isNaN(disciplineIdInt)) {
          return res.status(400).json({ message: "Invalid disciplineId" });
        }
        if (floorId && isNaN(floorIdInt!)) {
          return res.status(400).json({ message: "Invalid floorId" });
        }

        const drawingData = {
          companyId: typeof companyId === 'string' ? parseInt(companyId, 10) : companyId,
          name: title, // Add required name field
          description: '', // Add required description field
          data: {
            sheetNo,
            title,
          },
          disciplineId: disciplineIdInt, // Top level, as integer
          floorId: floorIdInt, // Top level, as integer or null
          createdBy: userIdAsNumber,
        };
        console.log('Creating drawing with data:', drawingData);
        const drawing = await storage.createDrawing(drawingData);
        console.log('Drawing creation result:', drawing);
        drawingId = drawing.id;
        console.log('Created drawing with ID:', drawingId);
        
        if (!drawingId) {
          throw new Error('Failed to create drawing - no ID returned');
        }
      } else {
        // versionType === 'update'
        // Use parentDrawingId and verify it exists
        const drawing = await storage.getDrawing(parentDrawingId);
        if (!drawing) {
          return res.status(404).json({ message: "Parent drawing not found" });
        }
        drawingId = parentDrawingId;
      }

      // Revision Number Generation
      const existingRevisions = await storage.getDrawingRevisions(drawingId);
      const revisionCount = existingRevisions.length + 1;
      const uniqueId = randomUUID().split('-')[0]; // First segment of UUID (8 chars)
      const revisionNo = `R${revisionCount}_${uniqueId}`;
      console.log(`Auto-generated revision number: ${revisionNo}`);

      // File Upload (PDF Only - NO CONVERSION)
      // Use local storage for development
      const timestamp = Date.now();
      const fileName = file.originalname;
      const fileSize = file.size.toString();

      // Save original PDF locally
      const pdfFileName = `${drawingId}_${revisionNo}_${Date.now()}.pdf`;
      const pdfPath = `drawings/${pdfFileName}`;
      
      const pdfSignedUrl = await localStorage.uploadFile(pdfPath, file.buffer, 'application/pdf');

      console.log('Manual PDF upload completed - no AI processing');

      // Get PDF page count using pdf-lib
      let pageCount = 1;
      try {
        const pdfDoc = await PDFDocument.load(file.buffer);
        pageCount = pdfDoc.getPageCount();
        console.log(`PDF has ${pageCount} pages`);
      } catch (error) {
        console.error('Error getting PDF page count:', error);
        // Default to 1 if we can't read the PDF
      }

      // Create Revision with uploadMethod='manual'
      const userIdAsNumber = getUserIdAsNumber(userId);
      const revisionData = {
        drawingId: parseInt(drawingId, 10), // This will be mapped to drawing_id by Drizzle
        version: revisionNo, // Map revisionNo to version
        changes: {
          status: 'draft',
          uploadMethod: 'manual',
        }, // Add changes field with status and upload method
        status: 'draft',
        fileUrl: pdfSignedUrl,
        fileName: fileName,
        fileType: 'application/pdf',
        fileSize: fileSize,
        uploadedBy: userIdAsNumber,
        createdBy: userIdAsNumber, // Required field in schema
      };

      console.log('Creating revision with data:', revisionData);
      const revision = await storage.createDrawingRevision(revisionData);

      // Return simplified response compatible with frontend success screen
      res.json({
        drawingId,
        revisionId: revision.id,
        pageCount: pageCount,
        uploadMethod: 'manual',
        extractedText: null,
        aiAnalysis: null,
      });
    } catch (error: any) {
      console.error("Error uploading drawing manually:", error);
      
      // Check for duplicate sheet number error
      if (error?.code === '23505' && error?.constraint === 'drawings_sheet_no_unique') {
        return res.status(409).json({ 
          message: "رقم المخطط موجود بالفعل. الرجاء استخدام رقم مختلف أو تحديث المخطط الموجود.",
          code: "DUPLICATE_SHEET_NUMBER"
        });
      }
      
      res.status(500).json({ message: "فشل رفع المخطط. الرجاء المحاولة مرة أخرى." });
    }
  });

  // Drawing Pages routes
  app.get('/api/revisions/:id/pages', isAuthenticated, async (req, res) => {
    try {
      const pages = await storage.getRevisionPages(req.params.id);
      res.json(pages);
    } catch (error) {
      console.error("Error fetching revision pages:", error);
      res.status(500).json({ message: "Failed to fetch revision pages" });
    }
  });

  app.get('/api/pages/:id', isAuthenticated, async (req, res) => {
    try {
      const page = await storage.getDrawingPage(req.params.id);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }
      res.json(page);
    } catch (error) {
      console.error("Error fetching page:", error);
      res.status(500).json({ message: "Failed to fetch page" });
    }
  });

  // Layers routes
  app.get('/api/drawings/:id/layers', isAuthenticated, async (req, res) => {
    try {
      const layers = await storage.getDrawingLayers(req.params.id);
      res.json(layers);
    } catch (error) {
      console.error("Error fetching layers:", error);
      res.status(500).json({ message: "Failed to fetch layers" });
    }
  });

  app.post('/api/layers', isAuthenticated, async (req: any, res) => {
    try {
      console.log('POST /api/layers - req.user:', req.user);
      console.log('POST /api/layers - req.body:', req.body);
      
      const userId = req.user?.claims?.sub;
      if (!userId) {
        console.error('No user ID found in request');
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const userIdAsNumber = getUserIdAsNumber(userId);
      const layerData = {
        ...req.body,
        createdBy: userIdAsNumber,
      };
      
      console.log('Creating layer with data:', layerData);
      const layer = await storage.createLayer(layerData);
      res.json(layer);
    } catch (error) {
      console.error("Error creating layer:", error);
      res.status(500).json({ message: "Failed to create layer" });
    }
  });

  app.patch('/api/layers/:id/visibility', isAuthenticated, async (req, res) => {
    try {
      const { visible } = req.body;
      const layer = await storage.updateLayerVisibility(req.params.id, visible);
      res.json(layer);
    } catch (error) {
      console.error("Error updating layer visibility:", error);
      res.status(500).json({ message: "Failed to update layer visibility" });
    }
  });

  app.delete('/api/layers/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteLayer(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting layer:", error);
      res.status(500).json({ message: "Failed to delete layer" });
    }
  });

  // Pins routes
  app.get('/api/drawings/:id/pins', isAuthenticated, async (req, res) => {
    try {
      const pins = await storage.getDrawingPins(req.params.id);
      res.json(pins);
    } catch (error) {
      console.error("Error fetching pins:", error);
      res.status(500).json({ message: "Failed to fetch pins" });
    }
  });

  app.post('/api/pins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userIdAsNumber = getUserIdAsNumber(userId);
      
      // Prepare pin data with proper field mapping
      const pinData = {
        name: req.body.label || req.body.name || 'Pin', // Use label as name, fallback to name or default
        x: req.body.x.toString(),
        y: req.body.y.toString(),
        type: req.body.type || 'pin', // Default type is 'pin'
        data: req.body.data || null,
        drawingId: parseInt(req.body.drawingId, 10),
        layerId: req.body.layerId && req.body.layerId.toString().trim() !== '' ? parseInt(req.body.layerId, 10) : null,
        createdBy: userIdAsNumber,
      };
      
      // Validate required fields
      if (!pinData.drawingId || isNaN(pinData.drawingId)) {
        return res.status(400).json({ message: "drawingId is required and must be a number" });
      }
      
      const pin = await storage.createPin(pinData);
      res.json(pin);
    } catch (error: any) {
      console.error("Error creating pin:", error);
      const errorMessage = error?.message || "Failed to create pin";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.delete('/api/pins/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deletePin(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting pin:", error);
      res.status(500).json({ message: "Failed to delete pin" });
    }
  });

  // Tickets routes
  // Tickets list - allow without auth to avoid blocking UI in dev
  app.get('/api/tickets', async (req, res) => {
    try {
      const filters: any = {};
      
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.type) filters.type = Array.isArray(req.query.type) ? req.query.type : [req.query.type];
      if (req.query.status) filters.status = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
      if (req.query.priority) filters.priority = Array.isArray(req.query.priority) ? req.query.priority : [req.query.priority];
      if (req.query.assignedTo) filters.assignedTo = Array.isArray(req.query.assignedTo) ? req.query.assignedTo : [req.query.assignedTo];
      if (req.query.drawingId) filters.drawingId = Array.isArray(req.query.drawingId) ? req.query.drawingId : [req.query.drawingId];
      if (req.query.disciplineId) filters.disciplineId = Array.isArray(req.query.disciplineId) ? req.query.disciplineId : [req.query.disciplineId];
      if (req.query.layerId) filters.layerId = Array.isArray(req.query.layerId) ? req.query.layerId : [req.query.layerId];
      if (req.query.slaStatus) filters.slaStatus = req.query.slaStatus as 'overdue' | 'due_soon' | 'on_track';
      if (req.query.tags) filters.tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
      if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom as string;
      if (req.query.dateTo) filters.dateTo = req.query.dateTo as string;
      if (req.query.page) filters.page = parseInt(req.query.page as string);
      if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
      if (req.query.sortBy) filters.sortBy = req.query.sortBy as string;
      if (req.query.sortOrder) filters.sortOrder = req.query.sortOrder as 'asc' | 'desc';
      
      const result = await storage.getTicketsFiltered(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching tickets:", {
        code: (error as any)?.code,
        message: (error as any)?.message,
        sqlMessage: (error as any)?.sqlMessage,
      });
      // Fail-soft for UI
      res.status(200).json([]);
    }
  });

  app.get('/api/drawings/:id/tickets', isAuthenticated, async (req, res) => {
    try {
      const tickets = await storage.getDrawingTickets(req.params.id);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching drawing tickets:", error);
      res.status(500).json({ message: "Failed to fetch drawing tickets" });
    }
  });

  app.get('/api/tickets/:id', isAuthenticated, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  app.post('/api/tickets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userIdAsNumber = getUserIdAsNumber(userId);
      
      // Get companyId from request
      const companyId = (req.user as any)?.companyId || req.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }
      
      const { id, ...bodyWithoutId } = req.body;
      
      // Prepare ticket data with proper field mapping and type conversion
      const ticketData = {
        ...bodyWithoutId,
        companyId: typeof companyId === 'string' ? parseInt(companyId, 10) : companyId,
        title: req.body.title,
        description: req.body.description || null,
        type: req.body.type || 'issue',
        status: req.body.status || 'open',
        priority: req.body.priority || 'medium',
        // Parse numeric fields
        drawingId: req.body.drawingId ? (typeof req.body.drawingId === 'string' ? parseInt(req.body.drawingId, 10) : req.body.drawingId) : null,
        disciplineId: req.body.disciplineId ? (typeof req.body.disciplineId === 'string' ? parseInt(req.body.disciplineId, 10) : req.body.disciplineId) : null,
        pinId: req.body.pinId ? (typeof req.body.pinId === 'string' ? parseInt(req.body.pinId, 10) : req.body.pinId) : null,
        layerId: req.body.layerId ? (typeof req.body.layerId === 'string' ? parseInt(req.body.layerId, 10) : req.body.layerId) : null,
        assignedTo: req.body.assignedTo ? (typeof req.body.assignedTo === 'string' ? parseInt(req.body.assignedTo, 10) : req.body.assignedTo) : null,
        createdBy: userIdAsNumber,
      };
      
      // Validate required fields
      if (!ticketData.title || ticketData.title.trim() === '') {
        return res.status(400).json({ message: "Title is required" });
      }
      
      const ticket = await storage.createTicket(ticketData);
      res.json(ticket);
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      const errorMessage = error?.message || "Failed to create ticket";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.patch('/api/tickets/:id/status', isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      const ticket = await storage.updateTicketStatus(req.params.id, status);
      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket status:", error);
      res.status(500).json({ message: "Failed to update ticket status" });
    }
  });

  app.patch('/api/tickets/:id', isAuthenticated, async (req, res) => {
    try {
      const ticket = await storage.updateTicket(req.params.id, req.body);
      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });

  app.delete('/api/tickets/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTicket(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting ticket:", error);
      res.status(500).json({ message: "Failed to delete ticket" });
    }
  });

  app.patch('/api/tickets/bulk', isAuthenticated, async (req, res) => {
    try {
      const { ticketIds, updates } = req.body;
      
      if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
        return res.status(400).json({ message: "ticketIds array is required" });
      }
      
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ message: "updates object is required" });
      }
      
      const count = await storage.bulkUpdateTickets(ticketIds, updates);
      res.json({ updated: count, message: `${count} ticket(s) updated successfully` });
    } catch (error) {
      console.error("Error bulk updating tickets:", error);
      res.status(500).json({ message: "Failed to bulk update tickets" });
    }
  });

  app.get('/api/pins/:id/timeline', isAuthenticated, async (req, res) => {
    try {
      const timeline = await storage.getPinTimeline(req.params.id);
      res.json(timeline);
    } catch (error) {
      console.error("Error fetching pin timeline:", error);
      res.status(500).json({ message: "Failed to fetch pin timeline" });
    }
  });

  // Saved Views routes
  app.get('/api/saved-views', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const views = await storage.getSavedViews(userId);
      res.json(views);
    } catch (error) {
      console.error("Error fetching saved views:", error);
      res.status(500).json({ message: "Failed to fetch saved views" });
    }
  });

  app.get('/api/saved-views/:id', isAuthenticated, async (req, res) => {
    try {
      const view = await storage.getSavedView(req.params.id);
      if (!view) {
        return res.status(404).json({ message: "Saved view not found" });
      }
      res.json(view);
    } catch (error) {
      console.error("Error fetching saved view:", error);
      res.status(500).json({ message: "Failed to fetch saved view" });
    }
  });

  app.post('/api/saved-views', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const viewData = {
        ...req.body,
        userId,
      };
      const view = await storage.createSavedView(viewData);
      res.json(view);
    } catch (error) {
      console.error("Error creating saved view:", error);
      res.status(500).json({ message: "Failed to create saved view" });
    }
  });

  app.put('/api/saved-views/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existingView = await storage.getSavedView(req.params.id);
      
      if (!existingView) {
        return res.status(404).json({ message: "Saved view not found" });
      }
      
      if (existingView.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this view" });
      }
      
      const view = await storage.updateSavedView(req.params.id, req.body);
      res.json(view);
    } catch (error) {
      console.error("Error updating saved view:", error);
      res.status(500).json({ message: "Failed to update saved view" });
    }
  });

  app.delete('/api/saved-views/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existingView = await storage.getSavedView(req.params.id);
      
      if (!existingView) {
        return res.status(404).json({ message: "Saved view not found" });
      }
      
      if (existingView.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this view" });
      }
      
      await storage.deleteSavedView(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting saved view:", error);
      res.status(500).json({ message: "Failed to delete saved view" });
    }
  });

  // Push Notifications Routes
  app.post('/api/push/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subscription } = req.body;

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ message: "Invalid subscription data" });
      }

      // Save subscription to database
      await storage.savePushSubscription(userId, subscription);
      
      res.json({ message: "Subscription saved successfully" });
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  app.post('/api/push/unsubscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint is required" });
      }

      // Delete subscription from database
      await storage.deletePushSubscription(userId, endpoint);
      
      res.json({ message: "Subscription removed successfully" });
    } catch (error) {
      console.error("Error removing push subscription:", error);
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });

  app.post('/api/push/send', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, title, body, icon, badge, data } = req.body;

      if (!userId || !title || !body) {
        return res.status(400).json({ message: "userId, title, and body are required" });
      }

      // Get user's push subscriptions
      const subscriptions = await storage.getPushSubscriptions(userId);

      if (subscriptions.length === 0) {
        return res.status(404).json({ message: "No subscriptions found for user" });
      }

      // Import web-push dynamically
      const webpush = await import('web-push');

      // Get VAPID keys from environment
      const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

      if (!vapidPublicKey || !vapidPrivateKey) {
        return res.status(500).json({ message: "VAPID keys not configured" });
      }

      // Set VAPID details
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

      // Send notification to all subscriptions
      const promises = subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(subscription, JSON.stringify({
            title,
            body,
            icon: icon || '/icons/icon-192x192.png',
            badge: badge || '/icons/icon-192x192.png',
            data: data || {},
          }));
        } catch (error: any) {
          // If subscription is invalid, remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await storage.deletePushSubscription(userId, subscription.endpoint);
          }
          throw error;
        }
      });

      await Promise.allSettled(promises);

      res.json({ message: "Notifications sent successfully", count: subscriptions.length });
    } catch (error) {
      console.error("Error sending push notification:", error);
      res.status(500).json({ message: "Failed to send notification" });
    }
  });

  // Get VAPID public key
  app.get('/api/push/vapid-public-key', (req, res) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      return res.status(500).json({ message: "VAPID keys not configured" });
    }
    res.json({ publicKey: vapidPublicKey });
  });


  return httpServer;
}
