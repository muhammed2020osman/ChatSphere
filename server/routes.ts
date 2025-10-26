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
import { extractMentions, findUserIdsByUsernames, requireAdmin } from "./utils";
import { analyzeEngineeringDrawing } from "./services/gemini";
import { convertPDFToImage, convertPDFPagesToImages, isPDF } from "./services/pdfConverter";
import { extractPDFText } from "./services/pdfTextExtractor";
import { 
  insertChannelSchema, 
  insertMessageSchema, 
  insertDirectMessageSchema,
  insertReactionSchema 
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

// Configure multer for file upload (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    console.log('Multer fileFilter - file:', file.originalname, 'mimetype:', file.mimetype);
    // Accept only PDF, PNG, JPG files
    const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      console.log('File accepted by multer');
      cb(null, true);
    } else {
      console.log('File rejected by multer - invalid type:', file.mimetype);
      cb(new Error('Invalid file type. Only PDF, PNG, and JPG files are allowed.'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

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
      const filePath = req.params[0];
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
      
      // Auto-join creator to the channel
      await storage.joinChannel(channel.id, userId);
      
      // Only broadcast public channels to all clients
      // Private channels are only visible to members
      if (!channel.isPrivate || channel.isPrivate === false) {
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
      
      // Extract mentions from content
      const mentions = req.body.content ? extractMentions(req.body.content) : [];
      
      const data = insertMessageSchema.parse({
        ...req.body,
        id: randomUUID(),
        userId,
        mentions,
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
      
      // Create notifications for mentioned users
      if (mentions.length > 0) {
        const allUsers = await storage.getAllUsers();
        const mentionedUserIds = await findUserIdsByUsernames(mentions, allUsers);
        
        // Create notifications for each mentioned user (except the sender)
        for (const mentionedUserId of mentionedUserIds) {
          if (mentionedUserId !== userId) {
            try {
              await storage.createNotification({
                userId: mentionedUserId,
                type: 'mention',
                messageId: message.id,
                channelId: message.channelId,
                fromUserId: userId,
                content: message.content || '',
                isRead: false,
              });
              
              // Send real-time notification to mentioned user
              const mentionedClient = clients.get(mentionedUserId);
              if (mentionedClient?.ws.readyState === WebSocket.OPEN) {
                mentionedClient.ws.send(JSON.stringify({
                  type: 'new_notification',
                  notification: {
                    type: 'mention',
                    fromUser: user,
                    channel,
                    content: message.content,
                  },
                }));
              }
            } catch (error) {
              console.error('Error creating notification:', error);
            }
          }
        }
      }
      
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

  // Reaction routes
  app.post('/api/reactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertReactionSchema.parse({
        ...req.body,
        userId,
      });

      // Get the message to verify it exists and get its channel
      const channelMessages = await storage.searchMessages('', userId);
      const message = channelMessages.find(m => m.id === data.messageId);
      
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

      const reaction = await storage.addReaction(data);
      const user = await storage.getUser(userId);
      const reactionWithUser = { ...reaction, user };

      // Broadcast using server-derived channelId
      broadcastToChannel(message.channelId, {
        type: 'new_reaction',
        messageId: data.messageId,
        reaction: reactionWithUser,
      });

      res.json(reaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reaction data", errors: error.errors });
      }
      console.error("Error adding reaction:", error);
      res.status(500).json({ message: "Failed to add reaction" });
    }
  });

  app.delete('/api/reactions/:messageId/:icon', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { messageId, icon } = req.params;

      // Get the message to verify access
      const channelMessages = await storage.searchMessages('', userId);
      const message = channelMessages.find(m => m.id === messageId);
      
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

      // Get the message to verify access
      const channelMessages = await storage.searchMessages('', userId);
      const message = channelMessages.find(m => m.id === messageId);
      
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
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get('/api/notifications/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
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

      // Extract mentions from updated content
      const mentions = content ? extractMentions(content) : [];
      const updatedMessage = await storage.updateMessage(id, content, mentions);

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
      const threads = await storage.getUserThreads(userId);
      res.json(threads);
    } catch (error) {
      console.error("Error fetching threads:", error);
      res.status(500).json({ message: "Failed to fetch threads" });
    }
  });

  // Disciplines routes
  app.get('/api/disciplines', isAuthenticated, async (req: any, res) => {
    try {
      const disciplines = await storage.getAllDisciplines();
      res.json(disciplines);
    } catch (error) {
      console.error("Error fetching disciplines:", error);
      res.status(500).json({ message: "Failed to fetch disciplines" });
    }
  });

  // Floors routes
  app.get('/api/floors', isAuthenticated, async (req: any, res) => {
    try {
      const floors = await storage.getAllFloors();
      res.json(floors);
    } catch (error) {
      console.error("Error fetching floors:", error);
      res.status(500).json({ message: "Failed to fetch floors" });
    }
  });

  // Drawings routes
  app.get('/api/drawings', isAuthenticated, async (req: any, res) => {
    try {
      const { page = 1, limit = 30 } = req.query;
      const drawings = await storage.getDrawings(parseInt(page), parseInt(limit));
      res.json(drawings);
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
      
      const starred = await storage.starMessage(id, userId);
      res.json(starred);
    } catch (error) {
      console.error("Error starring message:", error);
      res.status(500).json({ message: "Failed to star message" });
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
      if (error.message.includes('not found')) {
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

  // Drawings routes - Public reference data endpoints (no auth required)
  app.get('/api/disciplines', async (req, res) => {
    try {
      const disciplines = await storage.getDisciplines();
      res.json(disciplines);
    } catch (error) {
      console.error("Error fetching disciplines:", error);
      res.status(500).json({ message: "Failed to fetch disciplines" });
    }
  });

  app.get('/api/floors', async (req, res) => {
    try {
      const floors = await storage.getFloors();
      res.json(floors);
    } catch (error) {
      console.error("Error fetching floors:", error);
      res.status(500).json({ message: "Failed to fetch floors" });
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
      const { drawingNo, title, sheetNo, ...rest } = req.body;
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
        createdBy: userId,
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
      res.json(revisions);
    } catch (error) {
      console.error("Error fetching revisions:", error);
      res.status(500).json({ message: "Failed to fetch revisions" });
    }
  });

  app.post('/api/drawings/:id/revisions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const revisionData = {
        ...req.body,
        drawingId: req.params.id,
        createdBy: userId,
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
      let extractedTextData: any = null;
      
      if (fileType === 'application/pdf' || isPDF(fileBuffer)) {
        console.log('Multi-page PDF detected - processing...');
        isPdfFile = true;
        
        try {
          // Step 1: Extract text from entire PDF
          console.log('Step 1: Extracting text from PDF...');
          extractedTextData = await extractPDFText(fileBuffer);
          console.log(`Text extracted from ${extractedTextData.numPages} pages. Metadata:`, extractedTextData.metadata);
          
          // Step 2: Convert all PDF pages to PNG images
          console.log('Step 2: Converting all PDF pages to images...');
          const pdfConversionResults = await convertPDFPagesToImages(fileBuffer);
          console.log(`Converted ${pdfConversionResults.length} pages`);
          
          // Step 3: Save original PDF locally
          console.log('Step 3: Saving original PDF locally...');
          const pdfFileName = `${drawingId}_${revisionNo}_${timestamp}.pdf`;
          const pdfPath = `drawings/${pdfFileName}`;
          
          pdfUrl = await localStorage.uploadFile(pdfPath, fileBuffer, 'application/pdf');
          console.log('Original PDF saved locally');
          
          // Step 4: Process each page - upload images and analyze with AI
          console.log('Step 4: Processing individual pages...');
          for (let pageIndex = 0; pageIndex < pdfConversionResults.length; pageIndex++) {
            const pageResult = pdfConversionResults[pageIndex];
            const pageNumber = pageIndex + 1;
            
            console.log(`Processing page ${pageNumber}/${pdfConversionResults.length}...`);
            
            // Upload page image locally
            const pageImageFileName = `${drawingId}_${revisionNo}_p${pageNumber}_${timestamp}.png`;
            const pageImagePath = `drawings/${pageImageFileName}`;
            
            const pageImageUrl = await localStorage.uploadFile(pageImagePath, pageResult.imageBuffer, 'image/png');
            
            // Analyze page with Gemini AI
            let pageAiData = null;
            try {
              console.log(`Analyzing page ${pageNumber} with Gemini AI...`);
              pageAiData = await analyzeEngineeringDrawing(pageResult.imageBuffer, 'image/png');
              console.log(`Page ${pageNumber} AI analysis completed`);
            } catch (aiError) {
              console.error(`AI analysis failed for page ${pageNumber} (continuing):`, aiError);
            }
            
            pageResults.push({
              pageNumber,
              imageUrl: pageImageUrl,
              width: pageResult.width.toString(),
              height: pageResult.height.toString(),
              aiExtractedData: pageAiData,
            });
          }
          
          // Use first page for revision thumbnail
          fileBuffer = pdfConversionResults[0].imageBuffer;
          fileType = 'image/png';
          
        } catch (pdfError) {
          console.error('Failed to process PDF:', pdfError);
          return res.status(400).json({ 
            message: "Failed to process PDF file. Please ensure it's a valid PDF or try uploading as PNG/JPG." 
          });
        }
      } else {
        // Single image file (PNG/JPG)
        console.log('Single image file detected');
        
        // Analyze with Gemini AI (skip in development if needed)
        let aiData = null;
        if (process.env.SKIP_AI_ANALYSIS === 'true' || process.env.NODE_ENV === 'development') {
          console.log('Skipping AI analysis (SKIP_AI_ANALYSIS=true)');
          aiData = {
            title: "Engineering Drawing",
            summary: "Drawing uploaded without AI analysis",
            layers: [],
            dimensions: [],
            elements: [],
            titleBlock: {},
            annotations: []
          };
        } else {
          try {
            console.log('Analyzing image with Gemini AI...');
            aiData = await analyzeEngineeringDrawing(fileBuffer, fileType);
            console.log('AI analysis completed');
          } catch (aiError) {
            console.error('AI analysis failed (continuing):', aiError);
            // Provide fallback data
            aiData = {
              title: "Engineering Drawing",
              summary: "Drawing uploaded - AI analysis failed",
              layers: [],
              dimensions: [],
              elements: [],
              titleBlock: {},
              annotations: []
            };
          }
        }
        
        // Create single page result
        pageResults.push({
          pageNumber: 1,
          imageUrl: '', // Will be set after upload
          aiExtractedData: aiData,
        });
      }

      // Upload main thumbnail image locally
      const fileExtension = isPdfFile ? 'png' : fileName.split('.').pop();
      const uniqueFileName = `${drawingId}_${revisionNo}_${timestamp}.${fileExtension}`;
      const imagePath = `drawings/${uniqueFileName}`;
      
      const thumbnailUrl = await localStorage.uploadFile(imagePath, fileBuffer, fileType);

      // Create drawing revision
      const revisionData = {
        drawingId,
        revisionNo,
        version: revisionNo, // Map revisionNo to version
        changes: {}, // Add changes field
        createdBy: userId,
        status: 'draft' as const,
        fileUrl: isPdfFile ? pdfUrl : thumbnailUrl, // PDF URL or image URL
        thumbnailUrl,
        fileName,
        fileType: isPdfFile ? 'application/pdf' : fileType,
        fileSize,
        aiExtractedData: extractedTextData as any, // Store PDF text extraction in revision
        uploadedBy: userId,
      };

      const revision = await storage.createDrawingRevision(revisionData);
      
      // Create drawing pages in database
      if (pageResults.length > 0) {
        console.log(`Creating ${pageResults.length} drawing pages in database...`);
        for (const pageData of pageResults) {
          // Update image URL for single image uploads
          if (!isPdfFile) {
            pageData.imageUrl = thumbnailUrl;
          }
          
          await storage.createDrawingPage({
            revisionId: revision.id,
            pageNumber: pageData.pageNumber.toString(),
            imageUrl: pageData.imageUrl,
            thumbnailUrl: pageData.imageUrl, // Same as image for now
            extractedText: extractedTextData?.text || null,
            extractedMetadata: extractedTextData?.metadata || null,
            aiExtractedData: pageData.aiExtractedData,
            width: pageData.width || null,
            height: pageData.height || null,
          });
        }
        console.log('All pages created successfully');
      }
      
      // Compile AI data from all pages
      const aiAnalysis = pageResults.length > 0 && pageResults[0].aiExtractedData 
        ? pageResults[0].aiExtractedData 
        : null;

      res.json({
        drawingId: drawing.id,
        revisionId: revision.id,
        pageCount: pageResults.length,
        extractedText: {
          fullText: extractedTextData?.text || "",
          metadata: extractedTextData?.metadata || {
            sheetNumbers: [],
            roomNames: [],
            dimensions: [],
          },
        },
        aiAnalysis: aiAnalysis,
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

      // Drawing Creation/Selection based on versionType
      console.log('Version type:', versionType);
      if (versionType === 'new') {
        // Create new drawing
        const drawingData = {
          name: title, // Add required name field
          description: '', // Add required description field
          data: {
            sheetNo,
            title,
            disciplineId,
            floorId: floorId || null,
          },
          createdBy: userId,
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

      // Create Revision with uploadMethod='manual'
      const revisionData = {
        drawingId: drawingId, // This will be mapped to drawing_id by Drizzle
        version: revisionNo, // Map revisionNo to version
        changes: {
          fileUrl: pdfSignedUrl,
          fileName: fileName,
          fileType: 'application/pdf',
          fileSize: fileSize,
          status: 'draft',
        }, // Add changes field with file info
        createdBy: userId,
      };

      console.log('Creating revision with data:', revisionData);
      const revision = await storage.createDrawingRevision(revisionData);

      // Return simplified response compatible with frontend success screen
      res.json({
        drawingId,
        revisionId: revision.id,
        pageCount: 1,
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
      const userId = req.user.claims.sub;
      const layerData = {
        ...req.body,
        createdBy: userId,
      };
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
      const pinData = {
        ...req.body,
        // Convert empty string to null for layerId (optional field)
        layerId: req.body.layerId && req.body.layerId.trim() !== '' ? req.body.layerId : null,
        createdBy: userId,
      };
      const pin = await storage.createPin(pinData);
      res.json(pin);
    } catch (error) {
      console.error("Error creating pin:", error);
      res.status(500).json({ message: "Failed to create pin" });
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
  app.get('/api/tickets', isAuthenticated, async (req, res) => {
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
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
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
      const ticketData = {
        ...req.body,
        // Convert empty strings to null for optional fields
        layerId: req.body.layerId && req.body.layerId.trim() !== '' ? req.body.layerId : null,
        assignedTo: req.body.assignedTo && req.body.assignedTo.trim() !== '' ? req.body.assignedTo : null,
        createdBy: userId,
      };
      const ticket = await storage.createTicket(ticketData);
      res.json(ticket);
    } catch (error) {
      console.error("Error creating ticket:", error);
      res.status(500).json({ message: "Failed to create ticket" });
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


  return httpServer;
}
