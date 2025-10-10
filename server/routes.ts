import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { parse as parseCookie } from "cookie";
import passport from "passport";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getSession } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { 
  insertChannelSchema, 
  insertMessageSchema, 
  insertDirectMessageSchema 
} from "@shared/schema";
import { z } from "zod";

// WebSocket client tracking with channel subscriptions
const clients = new Map<string, { ws: WebSocket; userId: string; channels: Set<string> }>();

// Helper to get authenticated userId from WebSocket request
async function getAuthenticatedUserId(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const sessionMiddleware = getSession();
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User routes
  app.get('/api/users', isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Channel routes
  app.get('/api/channels', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const channels = await storage.getUserChannels(userId);
      res.json(channels);
    } catch (error) {
      console.error("Error fetching channels:", error);
      res.status(500).json({ message: "Failed to fetch channels" });
    }
  });

  app.get('/api/channels/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const channel = await storage.getChannel(req.params.id);
      
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
      
      res.json(channel);
    } catch (error) {
      console.error("Error fetching channel:", error);
      res.status(500).json({ message: "Failed to fetch channel" });
    }
  });

  app.post('/api/channels', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertChannelSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      const channel = await storage.createChannel(data);
      
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
      const channel = await storage.getChannel(req.params.id);
      
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
  app.get('/api/channels/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const channel = await storage.getChannel(req.params.id);
      
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
      
      const messages = await storage.getChannelMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertMessageSchema.parse({
        ...req.body,
        userId,
      });
      
      // Verify user is a member of the channel
      const channel = await storage.getChannel(data.channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      
      const isMember = await storage.isChannelMember(data.channelId, userId);
      if (!isMember && channel.isPrivate) {
        return res.status(403).json({ message: "Access denied - not a member of this channel" });
      }
      
      const message = await storage.createMessage(data);
      
      // Get user info for the message
      const user = await storage.getUser(userId);
      const messageWithUser = { ...message, user };
      
      // Broadcast new message only to channel members
      broadcastToChannel(message.channelId, {
        type: 'new_message',
        channelId: message.channelId,
        message: messageWithUser,
      });
      
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
      const otherUserId = req.params.userId;
      const messages = await storage.getDirectMessages(currentUserId, otherUserId);
      
      // Get recipient info for proper display
      const recipient = await storage.getUser(otherUserId);
      
      const messagesWithUsers = messages.map((msg) => ({
        ...msg,
        recipient: msg.fromUserId === currentUserId ? recipient : msg.sender,
      }));
      
      res.json(messagesWithUsers);
    } catch (error) {
      console.error("Error fetching direct messages:", error);
      res.status(500).json({ message: "Failed to fetch direct messages" });
    }
  });

  app.post('/api/direct-messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertDirectMessageSchema.parse({
        ...req.body,
        fromUserId: userId,
      });
      const dm = await storage.createDirectMessage(data);
      
      // Get user info for the message
      const sender = await storage.getUser(userId);
      const recipient = await storage.getUser(data.toUserId);
      
      // Send to specific users (sender and recipient)
      const senderClient = clients.get(userId);
      const recipientClient = clients.get(data.toUserId);
      
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
      
      res.json(dm);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      console.error("Error creating direct message:", error);
      res.status(500).json({ message: "Failed to create direct message" });
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

  // Object storage routes - for file uploads in messages
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/attachments", isAuthenticated, async (req: any, res) => {
    if (!req.body.attachmentURL || !req.body.fileName) {
      return res.status(400).json({ error: "attachmentURL and fileName are required" });
    }

    const userId = req.user.claims.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.attachmentURL,
        {
          owner: userId,
          visibility: "public", // Message attachments are accessible to channel members
        },
      );

      res.status(200).json({
        objectPath: objectPath,
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

  return httpServer;
}
