import {
  users,
  channels,
  messages,
  directMessages,
  channelMembers,
  reactions,
  notifications,
  starredMessages,
  drawings,
  drawingRevisions,
  drawingPages,
  disciplines,
  floors,
  layers,
  pins,
  tickets,
  savedViews,
  type User,
  type UpsertUser,
  type Channel,
  type InsertChannel,
  type Message,
  type InsertMessage,
  type DirectMessage,
  type InsertDirectMessage,
  type InsertChannelMember,
  type MessageWithUser,
  type DirectMessageWithUser,
  type Reaction,
  type InsertReaction,
  type ReactionWithUser,
  type Notification,
  type InsertNotification,
  type NotificationWithUsers,
  type StarredMessage,
  type InsertStarredMessage,
  type Drawing,
  type InsertDrawing,
  type DrawingRevision,
  type InsertDrawingRevision,
  type DrawingPage,
  type InsertDrawingPage,
  type DrawingWithDetails,
  type Discipline,
  type Floor,
  type Layer,
  type InsertLayer,
  type Pin,
  type InsertPin,
  type Ticket,
  type InsertTicket,
  type SavedView,
  type InsertSavedView,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, sql, inArray, ilike, gte, lte, arrayOverlaps } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  updateUserRole(userId: string, role: string): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  
  // Channel operations
  getChannels(): Promise<Channel[]>;
  getUserChannels(userId: string): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  joinChannel(channelId: string, userId: string): Promise<void>;
  isChannelMember(channelId: string, userId: string): Promise<boolean>;
  
  // Message operations
  getChannelMessages(channelId: string): Promise<MessageWithUser[]>;
  getMessage(messageId: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  searchMessages(query: string, userId: string): Promise<MessageWithUser[]>;
  getUserThreads(userId: string): Promise<any[]>;
  
  // Direct message operations
  getDirectMessages(userId1: string, userId2: string): Promise<DirectMessageWithUser[]>;
  createDirectMessage(dm: InsertDirectMessage): Promise<DirectMessage>;
  
  // Reaction operations
  addReaction(reaction: InsertReaction): Promise<Reaction>;
  removeReaction(messageId: string, userId: string, icon: string): Promise<void>;
  getMessageReactions(messageId: string): Promise<ReactionWithUser[]>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string): Promise<NotificationWithUsers[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  
  // Message editing/deletion
  updateMessage(messageId: string, content: string, mentions?: string[]): Promise<Message>;
  deleteMessage(messageId: string): Promise<void>;
  
  // Starred messages operations
  starMessage(messageId: string, userId: string): Promise<StarredMessage>;
  unstarMessage(messageId: string, userId: string): Promise<void>;
  isMessageStarred(messageId: string, userId: string): Promise<boolean>;
  getUserStarredMessages(userId: string): Promise<MessageWithUser[]>;
  
  // Drawings operations
  getDisciplines(): Promise<Discipline[]>;
  getFloors(): Promise<Floor[]>;
  getDrawings(page?: number, limit?: number): Promise<{
    drawings: DrawingWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  getDrawing(id: string): Promise<DrawingWithDetails | undefined>;
  createDrawing(drawing: InsertDrawing): Promise<Drawing>;
  createDrawingRevision(revision: InsertDrawingRevision): Promise<DrawingRevision>;
  getDrawingRevisions(drawingId: string): Promise<DrawingRevision[]>;
  updateRevisionStatus(revisionId: string, status: string, reviewedBy: string, reviewNotes?: string): Promise<DrawingRevision>;
  
  // Drawing Pages operations
  createDrawingPage(page: InsertDrawingPage): Promise<DrawingPage>;
  getRevisionPages(revisionId: string): Promise<DrawingPage[]>;
  getDrawingPage(pageId: string): Promise<DrawingPage | undefined>;
  
  // Layers operations
  getDrawingLayers(drawingId: string): Promise<Layer[]>;
  createLayer(layer: InsertLayer): Promise<Layer>;
  updateLayerVisibility(layerId: string, visible: boolean): Promise<Layer>;
  deleteLayer(layerId: string): Promise<void>;
  
  // Pins operations
  getDrawingPins(drawingId: string): Promise<Pin[]>;
  createPin(pin: InsertPin): Promise<Pin>;
  deletePin(pinId: string): Promise<void>;
  
  // Tickets operations
  getTickets(): Promise<Ticket[]>;
  getTicketsFiltered(filters: {
    search?: string;
    type?: string[];
    status?: string[];
    priority?: string[];
    assignedTo?: string[];
    drawingId?: string[];
    disciplineId?: string[];
    layerId?: string[];
    slaStatus?: 'overdue' | 'due_soon' | 'on_track';
    tags?: string[];
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    tickets: Ticket[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  getDrawingTickets(drawingId: string): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicketStatus(ticketId: string, status: string): Promise<Ticket>;
  updateTicket(ticketId: string, updates: Partial<InsertTicket>): Promise<Ticket>;
  bulkUpdateTickets(ticketIds: string[], updates: Partial<InsertTicket>): Promise<number>;
  deleteTicket(ticketId: string): Promise<void>;
  getPinTimeline(pinId: string): Promise<any[]>;
  
  // Saved Views operations
  getSavedViews(userId: string): Promise<any[]>;
  getSavedView(id: string): Promise<any | undefined>;
  createSavedView(view: any): Promise<any>;
  updateSavedView(id: string, updates: any): Promise<any>;
  deleteSavedView(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if this is the first user (make them admin)
    const existingUsers = await db.select().from(users);
    const isFirstUser = existingUsers.length === 0;
    
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        role: isFirstUser ? 'admin' : 'member',
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
          // Don't overwrite role on update
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isOnline, lastSeen: new Date() })
      .where(eq(users.id, userId));
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  // Channel operations
  async getChannels(): Promise<Channel[]> {
    return await db.select().from(channels).orderBy(channels.createdAt);
  }

  async getUserChannels(userId: string): Promise<Channel[]> {
    // Get channels the user is a member of OR public channels
    const userChannelIds = await db
      .select({ channelId: channelMembers.channelId })
      .from(channelMembers)
      .where(eq(channelMembers.userId, userId));
    
    const memberChannelIds = userChannelIds.map(m => m.channelId);
    
    if (memberChannelIds.length === 0) {
      // Only return public channels if user has no memberships
      return await db
        .select()
        .from(channels)
        .where(eq(channels.isPrivate, false))
        .orderBy(channels.createdAt);
    }
    
    return await db
      .select()
      .from(channels)
      .where(
        or(
          inArray(channels.id, memberChannelIds),
          eq(channels.isPrivate, false)
        )
      )
      .orderBy(channels.createdAt);
  }

  async isChannelMember(channelId: string, userId: string): Promise<boolean> {
    const [membership] = await db
      .select()
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.userId, userId)
        )
      );
    return !!membership;
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id));
    return channel;
  }

  async createChannel(channelData: InsertChannel): Promise<Channel> {
    const [channel] = await db.insert(channels).values(channelData).returning();
    
    // Auto-join creator to channel
    await db.insert(channelMembers).values({
      channelId: channel.id,
      userId: channelData.createdBy,
    });
    
    return channel;
  }

  async joinChannel(channelId: string, userId: string): Promise<void> {
    await db.insert(channelMembers).values({ channelId, userId });
  }

  // Message operations
  async getChannelMessages(channelId: string): Promise<MessageWithUser[]> {
    const result = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        userId: messages.userId,
        content: messages.content,
        attachmentUrl: messages.attachmentUrl,
        attachmentType: messages.attachmentType,
        attachmentName: messages.attachmentName,
        threadParentId: messages.threadParentId,
        mentions: messages.mentions,
        editedAt: messages.editedAt,
        createdAt: messages.createdAt,
        user: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.channelId, channelId))
      .orderBy(messages.createdAt);

    return result.map((row) => ({
      id: row.id,
      channelId: row.channelId,
      userId: row.userId,
      content: row.content,
      attachmentUrl: row.attachmentUrl,
      attachmentType: row.attachmentType,
      attachmentName: row.attachmentName,
      threadParentId: row.threadParentId,
      mentions: row.mentions,
      editedAt: row.editedAt,
      createdAt: row.createdAt,
      user: row.user,
    }));
  }

  async getMessage(messageId: string): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
    return message;
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(messageData).returning();
    return message;
  }

  async searchMessages(query: string, userId: string): Promise<MessageWithUser[]> {
    // Get channels user has access to
    const userChannelIds = await db
      .select({ channelId: channelMembers.channelId })
      .from(channelMembers)
      .where(eq(channelMembers.userId, userId));
    
    const publicChannels = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.isPrivate, false));
    
    const accessibleChannelIds = [
      ...userChannelIds.map(m => m.channelId),
      ...publicChannels.map(c => c.id)
    ];
    
    if (accessibleChannelIds.length === 0) {
      return [];
    }
    
    const result = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        userId: messages.userId,
        content: messages.content,
        attachmentUrl: messages.attachmentUrl,
        attachmentType: messages.attachmentType,
        attachmentName: messages.attachmentName,
        threadParentId: messages.threadParentId,
        mentions: messages.mentions,
        editedAt: messages.editedAt,
        createdAt: messages.createdAt,
        user: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(
        and(
          sql`${messages.content} ILIKE ${'%' + query + '%'}`,
          inArray(messages.channelId, accessibleChannelIds)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(20);

    return result.map((row) => ({
      id: row.id,
      channelId: row.channelId,
      userId: row.userId,
      content: row.content,
      attachmentUrl: row.attachmentUrl,
      attachmentType: row.attachmentType,
      attachmentName: row.attachmentName,
      threadParentId: row.threadParentId,
      mentions: row.mentions,
      editedAt: row.editedAt,
      createdAt: row.createdAt,
      user: row.user,
    }));
  }

  async getUserThreads(userId: string): Promise<any[]> {
    // Get channels user has access to
    const userChannelIds = await db
      .select({ channelId: channelMembers.channelId })
      .from(channelMembers)
      .where(eq(channelMembers.userId, userId));
    
    const publicChannels = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.isPrivate, false));
    
    const accessibleChannelIds = [
      ...userChannelIds.map(m => m.channelId),
      ...publicChannels.map(c => c.id)
    ];
    
    if (accessibleChannelIds.length === 0) {
      return [];
    }

    // Get all replies by the user to find thread parent IDs
    const userReplies = await db
      .select({ threadParentId: messages.threadParentId })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          sql`${messages.threadParentId} IS NOT NULL`,
          inArray(messages.channelId, accessibleChannelIds)
        )
      );

    const threadParentIds = userReplies
      .map(r => r.threadParentId)
      .filter((id): id is string => id !== null);

    // Get threads user created that have replies
    const userCreatedThreads = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          sql`${messages.threadParentId} IS NULL`,
          inArray(messages.channelId, accessibleChannelIds)
        )
      );

    const userCreatedThreadIds = userCreatedThreads.map(t => t.id);

    // Combine both: threads user created + threads user replied to
    const allThreadIds = Array.from(new Set([...userCreatedThreadIds, ...threadParentIds]));

    if (allThreadIds.length === 0) {
      return [];
    }

    // Get full thread details
    const threads = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        userId: messages.userId,
        content: messages.content,
        createdAt: messages.createdAt,
        user: users,
        channelName: channels.name,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .leftJoin(channels, eq(messages.channelId, channels.id))
      .where(inArray(messages.id, allThreadIds))
      .orderBy(desc(messages.createdAt));

    // Get reply counts for each thread
    const threadsWithCounts = await Promise.all(
      threads.map(async (thread) => {
        const replyCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(eq(messages.threadParentId, thread.id));

        return {
          id: thread.id,
          channelId: thread.channelId,
          userId: thread.userId,
          content: thread.content,
          createdAt: thread.createdAt,
          user: thread.user,
          channel: thread.channelName ? { id: thread.channelId, name: thread.channelName } : undefined,
          replyCount: Number(replyCount[0]?.count || 0),
        };
      })
    );

    return threadsWithCounts.filter(t => t.replyCount > 0);
  }

  // Direct message operations
  async getDirectMessages(userId1: string, userId2: string): Promise<DirectMessageWithUser[]> {
    const result = await db
      .select({
        id: directMessages.id,
        fromUserId: directMessages.fromUserId,
        toUserId: directMessages.toUserId,
        content: directMessages.content,
        attachmentUrl: directMessages.attachmentUrl,
        attachmentType: directMessages.attachmentType,
        attachmentName: directMessages.attachmentName,
        createdAt: directMessages.createdAt,
        sender: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          status: users.status,
          isOnline: users.isOnline,
          lastSeen: users.lastSeen,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(directMessages)
      .innerJoin(users, eq(directMessages.fromUserId, users.id))
      .where(
        or(
          and(eq(directMessages.fromUserId, userId1), eq(directMessages.toUserId, userId2)),
          and(eq(directMessages.fromUserId, userId2), eq(directMessages.toUserId, userId1))
        )
      )
      .orderBy(directMessages.createdAt);

    return result.map((row) => ({
      id: row.id,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      content: row.content,
      attachmentUrl: row.attachmentUrl,
      attachmentType: row.attachmentType,
      attachmentName: row.attachmentName,
      createdAt: row.createdAt,
      sender: row.sender,
      recipient: row.sender, // Will be updated by API layer if needed
    }));
  }

  async createDirectMessage(dmData: InsertDirectMessage): Promise<DirectMessage> {
    const [dm] = await db.insert(directMessages).values(dmData).returning();
    return dm;
  }

  // Reaction operations
  async addReaction(reactionData: InsertReaction): Promise<Reaction> {
    // Check if user already reacted with this icon
    const existing = await db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.messageId, reactionData.messageId),
          eq(reactions.userId, reactionData.userId),
          eq(reactions.icon, reactionData.icon)
        )
      );
    
    if (existing.length > 0) {
      return existing[0];
    }

    const [reaction] = await db.insert(reactions).values(reactionData).returning();
    return reaction;
  }

  async removeReaction(messageId: string, userId: string, icon: string): Promise<void> {
    await db
      .delete(reactions)
      .where(
        and(
          eq(reactions.messageId, messageId),
          eq(reactions.userId, userId),
          eq(reactions.icon, icon)
        )
      );
  }

  async getMessageReactions(messageId: string): Promise<ReactionWithUser[]> {
    const result = await db
      .select({
        id: reactions.id,
        messageId: reactions.messageId,
        userId: reactions.userId,
        icon: reactions.icon,
        createdAt: reactions.createdAt,
        user: users,
      })
      .from(reactions)
      .innerJoin(users, eq(reactions.userId, users.id))
      .where(eq(reactions.messageId, messageId))
      .orderBy(reactions.createdAt);

    return result.map((row) => ({
      id: row.id,
      messageId: row.messageId,
      userId: row.userId,
      icon: row.icon,
      createdAt: row.createdAt,
      user: row.user,
    }));
  }

  // Notification operations
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(notificationData).returning();
    return notification;
  }

  async getUserNotifications(userId: string): Promise<NotificationWithUsers[]> {
    const result = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        type: notifications.type,
        messageId: notifications.messageId,
        channelId: notifications.channelId,
        fromUserId: notifications.fromUserId,
        content: notifications.content,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        fromUser: users,
        channel: channels,
      })
      .from(notifications)
      .innerJoin(users, eq(notifications.fromUserId, users.id))
      .leftJoin(channels, eq(notifications.channelId, channels.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return result.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      messageId: row.messageId,
      channelId: row.channelId,
      fromUserId: row.fromUserId,
      content: row.content,
      isRead: row.isRead,
      createdAt: row.createdAt,
      fromUser: row.fromUser,
      channel: row.channel || undefined,
    }));
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
    
    return Number(result[0]?.count || 0);
  }

  // Message editing/deletion
  async updateMessage(messageId: string, content: string, mentions?: string[]): Promise<Message> {
    const [message] = await db
      .update(messages)
      .set({ 
        content, 
        editedAt: new Date(),
        mentions: mentions || [],
      })
      .where(eq(messages.id, messageId))
      .returning();
    
    return message;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, messageId));
  }

  // Starred messages operations
  async starMessage(messageId: string, userId: string): Promise<StarredMessage> {
    const [starred] = await db
      .insert(starredMessages)
      .values({ messageId, userId })
      .onConflictDoNothing()
      .returning();
    
    return starred;
  }

  async unstarMessage(messageId: string, userId: string): Promise<void> {
    await db
      .delete(starredMessages)
      .where(
        and(
          eq(starredMessages.messageId, messageId),
          eq(starredMessages.userId, userId)
        )
      );
  }

  async isMessageStarred(messageId: string, userId: string): Promise<boolean> {
    const [starred] = await db
      .select()
      .from(starredMessages)
      .where(
        and(
          eq(starredMessages.messageId, messageId),
          eq(starredMessages.userId, userId)
        )
      );
    
    return !!starred;
  }

  async getUserStarredMessages(userId: string): Promise<MessageWithUser[]> {
    // Get ALL starred messages for the user first
    const allStarredResults = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        userId: messages.userId,
        content: messages.content,
        attachmentUrl: messages.attachmentUrl,
        attachmentType: messages.attachmentType,
        attachmentName: messages.attachmentName,
        threadParentId: messages.threadParentId,
        mentions: messages.mentions,
        editedAt: messages.editedAt,
        createdAt: messages.createdAt,
        user: users,
        channel: channels,
      })
      .from(starredMessages)
      .innerJoin(messages, eq(starredMessages.messageId, messages.id))
      .innerJoin(users, eq(messages.userId, users.id))
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .where(eq(starredMessages.userId, userId))
      .orderBy(desc(starredMessages.createdAt));

    // Filter to only messages from channels user can access
    const accessibleResults = [];
    
    for (const row of allStarredResults) {
      const channel = row.channel;
      
      // Public channels are always accessible
      if (!channel.isPrivate) {
        accessibleResults.push(row);
        continue;
      }
      
      // For private channels, verify membership
      const isMember = await this.isChannelMember(channel.id, userId);
      if (isMember) {
        accessibleResults.push(row);
      }
    }

    return accessibleResults.map((row) => ({
      id: row.id,
      channelId: row.channelId,
      userId: row.userId,
      content: row.content,
      attachmentUrl: row.attachmentUrl,
      attachmentType: row.attachmentType,
      attachmentName: row.attachmentName,
      threadParentId: row.threadParentId,
      mentions: row.mentions,
      editedAt: row.editedAt,
      createdAt: row.createdAt,
      user: row.user,
    }));
  }

  // Drawings operations
  async getDisciplines(): Promise<Discipline[]> {
    return await db.select().from(disciplines);
  }

  async getFloors(): Promise<Floor[]> {
    return await db.select().from(floors).orderBy(floors.sortOrder);
  }

  async getDrawings(page: number = 1, limit: number = 30): Promise<{
    drawings: DrawingWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(drawings);
    
    const total = totalCount || 0;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // First, get paginated drawings with their basic relationships
    const results = await db
      .select({
        drawing: drawings,
        discipline: disciplines,
        floor: floors,
        creator: users,
      })
      .from(drawings)
      .leftJoin(disciplines, eq(drawings.disciplineId, disciplines.id))
      .leftJoin(floors, eq(drawings.floorId, floors.id))
      .leftJoin(users, eq(drawings.createdBy, users.id))
      .orderBy(desc(drawings.updatedAt))
      .limit(limit)
      .offset(offset);

    if (results.length === 0) {
      return {
        drawings: [],
        total,
        page,
        limit,
        totalPages,
      };
    }

    // Get all drawing IDs
    const drawingIds = results.map((r) => r.drawing.id);

    // Get revision counts for all drawings in one query
    const revisionCounts = await db
      .select({
        drawingId: drawingRevisions.drawingId,
        count: sql<number>`count(*)::int`,
      })
      .from(drawingRevisions)
      .where(sql`${drawingRevisions.drawingId} IN (${sql.join(drawingIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(drawingRevisions.drawingId);

    const revisionCountMap = new Map(
      revisionCounts.map((rc) => [rc.drawingId, rc.count])
    );

    // Get latest revision for each drawing using a subquery with ROW_NUMBER()
    const uploaderUser = alias(users, 'uploader_user');
    
    const latestRevisions = await db
      .select({
        drawingId: sql<string>`dr.drawing_id`,
        revision: sql<any>`dr.*`,
        uploader: uploaderUser,
      })
      .from(sql`(
        SELECT *, ROW_NUMBER() OVER (PARTITION BY drawing_id ORDER BY uploaded_at DESC) as rn
        FROM drawing_revisions
        WHERE drawing_id IN (${sql.join(drawingIds.map(id => sql`${id}`), sql`, `)})
      ) dr`)
      .leftJoin(uploaderUser, sql`dr.uploaded_by = ${uploaderUser.id}`)
      .where(sql`dr.rn = 1`);

    const latestRevisionMap = new Map(
      latestRevisions.map((lr) => [lr.drawingId, {
        ...lr.revision,
        uploader: lr.uploader!,
      }])
    );

    // Combine all data
    const drawingsWithDetails = results.map((row) => ({
      ...row.drawing,
      discipline: row.discipline!,
      floor: row.floor || undefined,
      creator: row.creator!,
      revisionCount: revisionCountMap.get(row.drawing.id) || 0,
      latestRevision: latestRevisionMap.get(row.drawing.id),
    }));

    return {
      drawings: drawingsWithDetails,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getDrawing(id: string): Promise<DrawingWithDetails | undefined> {
    const [result] = await db
      .select({
        drawing: drawings,
        discipline: disciplines,
        floor: floors,
        creator: users,
      })
      .from(drawings)
      .leftJoin(disciplines, eq(drawings.disciplineId, disciplines.id))
      .leftJoin(floors, eq(drawings.floorId, floors.id))
      .leftJoin(users, eq(drawings.createdBy, users.id))
      .where(eq(drawings.id, id));

    if (!result) return undefined;

    // Get all revisions with uploader and reviewer using aliases
    const uploaderUser = alias(users, 'uploader_user');
    const reviewerUser = alias(users, 'reviewer_user');
    
    const revisionResults = await db
      .select({
        revision: drawingRevisions,
        uploader: uploaderUser,
        reviewer: reviewerUser,
      })
      .from(drawingRevisions)
      .leftJoin(uploaderUser, eq(drawingRevisions.uploadedBy, uploaderUser.id))
      .leftJoin(reviewerUser, eq(drawingRevisions.reviewedBy, reviewerUser.id))
      .where(eq(drawingRevisions.drawingId, id))
      .orderBy(desc(drawingRevisions.uploadedAt));

    return {
      ...result.drawing,
      discipline: result.discipline!,
      floor: result.floor || undefined,
      creator: result.creator!,
      revisions: revisionResults.map((r) => ({
        ...r.revision,
        uploader: r.uploader!,
        reviewer: r.reviewer || undefined,
      })),
      latestRevision: revisionResults.length > 0 ? {
        ...revisionResults[0].revision,
        uploader: revisionResults[0].uploader!,
        reviewer: revisionResults[0].reviewer || undefined,
      } : undefined,
    };
  }

  async getDrawingBySheetNo(sheetNo: string): Promise<Drawing | undefined> {
    const [drawing] = await db
      .select()
      .from(drawings)
      .where(eq(drawings.sheetNo, sheetNo))
      .limit(1);
    return drawing;
  }

  async createDrawing(drawingData: InsertDrawing): Promise<Drawing> {
    const [drawing] = await db
      .insert(drawings)
      .values(drawingData)
      .returning();
    return drawing;
  }

  async createDrawingRevision(revisionData: InsertDrawingRevision): Promise<DrawingRevision> {
    // Mark all previous revisions as superseded
    await db
      .update(drawingRevisions)
      .set({ status: 'superseded' })
      .where(
        and(
          eq(drawingRevisions.drawingId, revisionData.drawingId),
          eq(drawingRevisions.status, 'approved')
        )
      );

    const [revision] = await db
      .insert(drawingRevisions)
      .values(revisionData)
      .returning();

    // Update drawing's updatedAt
    await db
      .update(drawings)
      .set({ updatedAt: new Date() })
      .where(eq(drawings.id, revisionData.drawingId));

    return revision;
  }

  async getDrawingRevisions(drawingId: string): Promise<DrawingRevision[]> {
    return await db
      .select()
      .from(drawingRevisions)
      .where(eq(drawingRevisions.drawingId, drawingId))
      .orderBy(desc(drawingRevisions.uploadedAt));
  }

  async updateRevisionStatus(
    revisionId: string,
    status: string,
    reviewedBy: string,
    reviewNotes?: string
  ): Promise<DrawingRevision> {
    const [revision] = await db
      .update(drawingRevisions)
      .set({
        status,
        reviewedBy,
        reviewNotes,
        reviewedAt: new Date(),
      })
      .where(eq(drawingRevisions.id, revisionId))
      .returning();

    // If approved, mark other approved revisions as superseded
    if (status === 'approved') {
      await db
        .update(drawingRevisions)
        .set({ status: 'superseded' })
        .where(
          and(
            eq(drawingRevisions.drawingId, revision.drawingId),
            eq(drawingRevisions.status, 'approved'),
            sql`${drawingRevisions.id} != ${revisionId}`
          )
        );
    }

    return revision;
  }

  // Drawing Pages operations
  async createDrawingPage(pageData: InsertDrawingPage): Promise<DrawingPage> {
    const [page] = await db
      .insert(drawingPages)
      .values(pageData)
      .returning();
    return page;
  }

  async getRevisionPages(revisionId: string): Promise<DrawingPage[]> {
    return await db
      .select()
      .from(drawingPages)
      .where(eq(drawingPages.revisionId, revisionId))
      .orderBy(drawingPages.pageNumber);
  }

  async getDrawingPage(pageId: string): Promise<DrawingPage | undefined> {
    const [page] = await db
      .select()
      .from(drawingPages)
      .where(eq(drawingPages.id, pageId));
    return page;
  }

  // Layers operations
  async getDrawingLayers(drawingId: string): Promise<Layer[]> {
    return await db
      .select()
      .from(layers)
      .where(eq(layers.drawingId, drawingId))
      .orderBy(layers.createdAt);
  }

  async createLayer(layerData: InsertLayer): Promise<Layer> {
    const [layer] = await db
      .insert(layers)
      .values(layerData)
      .returning();
    return layer;
  }

  async updateLayerVisibility(layerId: string, visible: boolean): Promise<Layer> {
    const [layer] = await db
      .update(layers)
      .set({ visible })
      .where(eq(layers.id, layerId))
      .returning();
    return layer;
  }

  async deleteLayer(layerId: string): Promise<void> {
    await db.delete(layers).where(eq(layers.id, layerId));
  }

  // Pins operations
  async getDrawingPins(drawingId: string): Promise<Pin[]> {
    const pinsData = await db
      .select({
        pin: pins,
        ticket: tickets,
      })
      .from(pins)
      .leftJoin(tickets, eq(tickets.pinId, pins.id))
      .where(eq(pins.drawingId, drawingId))
      .orderBy(pins.createdAt);
    
    // Group tickets by pin
    const pinsMap = new Map<string, any>();
    for (const row of pinsData) {
      if (!pinsMap.has(row.pin.id)) {
        pinsMap.set(row.pin.id, {
          ...row.pin,
          tickets: [],
        });
      }
      if (row.ticket) {
        pinsMap.get(row.pin.id).tickets.push(row.ticket);
      }
    }
    
    return Array.from(pinsMap.values());
  }

  async createPin(pinData: InsertPin): Promise<Pin> {
    const [pin] = await db
      .insert(pins)
      .values(pinData)
      .returning();
    return pin;
  }

  async deletePin(pinId: string): Promise<void> {
    await db.delete(pins).where(eq(pins.id, pinId));
  }

  // Tickets operations
  async getTickets(): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .orderBy(desc(tickets.createdAt));
  }

  async getDrawingTickets(drawingId: string): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .where(eq(tickets.drawingId, drawingId))
      .orderBy(desc(tickets.createdAt));
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, id));
    return ticket;
  }

  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    const [ticket] = await db
      .insert(tickets)
      .values(ticketData)
      .returning();
    return ticket;
  }

  async updateTicketStatus(ticketId: string, status: string): Promise<Ticket> {
    const [ticket] = await db
      .update(tickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
      .returning();
    return ticket;
  }

  async updateTicket(ticketId: string, updates: Partial<InsertTicket>): Promise<Ticket> {
    const [ticket] = await db
      .update(tickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
      .returning();
    return ticket;
  }

  async deleteTicket(ticketId: string): Promise<void> {
    await db.delete(tickets).where(eq(tickets.id, ticketId));
  }

  async getTicketsFiltered(filters: {
    search?: string;
    type?: string[];
    status?: string[];
    priority?: string[];
    assignedTo?: string[];
    drawingId?: string[];
    disciplineId?: string[];
    layerId?: string[];
    slaStatus?: 'overdue' | 'due_soon' | 'on_track';
    tags?: string[];
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    tickets: Ticket[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const sortOrder = filters.sortOrder === 'asc' ? asc : desc;
    const sortColumn = filters.sortBy || 'createdAt';

    const conditions: any[] = [];

    if (filters.search) {
      conditions.push(
        or(
          ilike(tickets.title, `%${filters.search}%`),
          ilike(tickets.description, `%${filters.search}%`)
        )
      );
    }

    if (filters.type && filters.type.length > 0) {
      conditions.push(inArray(tickets.type, filters.type));
    }

    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(tickets.status, filters.status));
    }

    if (filters.priority && filters.priority.length > 0) {
      conditions.push(inArray(tickets.priority, filters.priority));
    }

    if (filters.assignedTo && filters.assignedTo.length > 0) {
      conditions.push(inArray(tickets.assignedTo, filters.assignedTo.filter(Boolean)));
    }

    if (filters.drawingId && filters.drawingId.length > 0) {
      conditions.push(inArray(tickets.drawingId, filters.drawingId));
    }

    if (filters.disciplineId && filters.disciplineId.length > 0) {
      conditions.push(inArray(tickets.disciplineId, filters.disciplineId));
    }

    if (filters.layerId && filters.layerId.length > 0) {
      conditions.push(inArray(tickets.layerId, filters.layerId.filter(Boolean)));
    }

    if (filters.tags && filters.tags.length > 0) {
      conditions.push(arrayOverlaps(tickets.tags, filters.tags));
    }

    if (filters.dateFrom) {
      conditions.push(gte(tickets.createdAt, new Date(filters.dateFrom)));
    }

    if (filters.dateTo) {
      conditions.push(lte(tickets.createdAt, new Date(filters.dateTo)));
    }

    if (filters.slaStatus) {
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      if (filters.slaStatus === 'overdue') {
        conditions.push(
          and(
            sql`${tickets.dueDate} IS NOT NULL`,
            sql`${tickets.dueDate} < ${now}`
          )
        );
      } else if (filters.slaStatus === 'due_soon') {
        conditions.push(
          and(
            sql`${tickets.dueDate} IS NOT NULL`,
            sql`${tickets.dueDate} >= ${now}`,
            sql`${tickets.dueDate} <= ${twentyFourHoursFromNow}`
          )
        );
      } else if (filters.slaStatus === 'on_track') {
        conditions.push(
          and(
            sql`${tickets.dueDate} IS NOT NULL`,
            sql`${tickets.dueDate} > ${twentyFourHoursFromNow}`
          )
        );
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(whereClause);

    const total = Number(countResult.count);
    const totalPages = Math.ceil(total / limit);

    const sortColumnRef = (tickets as any)[sortColumn] || tickets.createdAt;

    const rawTickets = await db
      .select({
        ticket_id: tickets.id,
        ticket_title: tickets.title,
        ticket_description: tickets.description,
        ticket_type: tickets.type,
        ticket_status: tickets.status,
        ticket_priority: tickets.priority,
        ticket_drawingId: tickets.drawingId,
        ticket_disciplineId: tickets.disciplineId,
        ticket_pinId: tickets.pinId,
        ticket_layerId: tickets.layerId,
        ticket_assignedTo: tickets.assignedTo,
        ticket_createdBy: tickets.createdBy,
        ticket_reporter: tickets.reporter,
        ticket_channelId: tickets.channelId,
        ticket_slaHours: tickets.slaHours,
        ticket_dueDate: tickets.dueDate,
        ticket_tags: tickets.tags,
        ticket_createdAt: tickets.createdAt,
        ticket_updatedAt: tickets.updatedAt,
        drawing_id: drawings.id,
        drawing_sheetNo: drawings.sheetNo,
        drawing_title: drawings.title,
        drawing_disciplineId: drawings.disciplineId,
        discipline_id: disciplines.id,
        discipline_name: disciplines.name,
        discipline_code: disciplines.code,
        discipline_color: disciplines.color,
        pin_id: pins.id,
        pin_label: pins.label,
        pin_drawingId: pins.drawingId,
        pin_x: pins.x,
        pin_y: pins.y,
        layer_id: layers.id,
        layer_name: layers.name,
        assignee_id: users.id,
        assignee_email: users.email,
        assignee_firstName: users.firstName,
        assignee_lastName: users.lastName,
        assignee_profileImageUrl: users.profileImageUrl,
      })
      .from(tickets)
      .leftJoin(drawings, eq(tickets.drawingId, drawings.id))
      .leftJoin(disciplines, eq(tickets.disciplineId, disciplines.id))
      .leftJoin(pins, eq(tickets.pinId, pins.id))
      .leftJoin(layers, eq(tickets.layerId, layers.id))
      .leftJoin(users, eq(tickets.assignedTo, users.id))
      .where(whereClause)
      .orderBy(sortOrder(sortColumnRef))
      .limit(limit)
      .offset(offset);

    // Transform flat result to nested structure
    const ticketsList = rawTickets.map(row => ({
      id: row.ticket_id,
      title: row.ticket_title,
      description: row.ticket_description,
      type: row.ticket_type,
      status: row.ticket_status,
      priority: row.ticket_priority,
      drawingId: row.ticket_drawingId,
      disciplineId: row.ticket_disciplineId,
      pinId: row.ticket_pinId,
      layerId: row.ticket_layerId,
      assignedTo: row.ticket_assignedTo,
      createdBy: row.ticket_createdBy,
      reporter: row.ticket_reporter,
      channelId: row.ticket_channelId,
      slaHours: row.ticket_slaHours,
      dueDate: row.ticket_dueDate,
      tags: row.ticket_tags,
      createdAt: row.ticket_createdAt,
      updatedAt: row.ticket_updatedAt,
      drawing: row.drawing_id ? {
        id: row.drawing_id,
        sheetNumber: row.drawing_sheetNo!,
        title: row.drawing_title,
        disciplineId: row.drawing_disciplineId!,
      } : undefined,
      discipline: row.discipline_id ? {
        id: row.discipline_id,
        name: row.discipline_name!,
        code: row.discipline_code!,
        color: row.discipline_color,
      } : undefined,
      pin: row.pin_id ? {
        id: row.pin_id,
        label: row.pin_label,
        drawingId: row.pin_drawingId!,
        x: row.pin_x!,
        y: row.pin_y!,
      } : undefined,
      layer: row.layer_id ? {
        id: row.layer_id,
        name: row.layer_name!,
      } : undefined,
      assignee: row.assignee_id ? {
        id: row.assignee_id,
        email: row.assignee_email!,
        firstName: row.assignee_firstName,
        lastName: row.assignee_lastName,
        profileImageUrl: row.assignee_profileImageUrl,
      } : undefined,
    }));

    return {
      tickets: ticketsList,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async bulkUpdateTickets(ticketIds: string[], updates: Partial<InsertTicket>): Promise<number> {
    if (ticketIds.length === 0) {
      return 0;
    }

    const result = await db
      .update(tickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(inArray(tickets.id, ticketIds))
      .returning({ id: tickets.id });

    return result.length;
  }

  async getPinTimeline(pinId: string): Promise<any[]> {
    const [pin] = await db
      .select({
        id: pins.id,
        label: pins.label,
        description: pins.description,
        createdBy: pins.createdBy,
        createdAt: pins.createdAt,
      })
      .from(pins)
      .where(eq(pins.id, pinId));

    if (!pin) {
      return [];
    }

    const pinTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.pinId, pinId))
      .orderBy(desc(tickets.createdAt));

    const timeline: any[] = [];

    timeline.push({
      type: 'pin_created',
      date: pin.createdAt,
      data: {
        pinId: pin.id,
        label: pin.label,
        description: pin.description,
        createdBy: pin.createdBy,
      },
    });

    for (const ticket of pinTickets) {
      timeline.push({
        type: 'ticket_created',
        date: ticket.createdAt,
        data: {
          ticketId: ticket.id,
          title: ticket.title,
          type: ticket.type,
          status: ticket.status,
          priority: ticket.priority,
          createdBy: ticket.createdBy,
        },
      });

      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        timeline.push({
          type: 'ticket_resolved',
          date: ticket.updatedAt,
          data: {
            ticketId: ticket.id,
            title: ticket.title,
            status: ticket.status,
          },
        });
      }
    }

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return timeline;
  }

  async getSavedViews(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(savedViews)
      .where(
        or(
          eq(savedViews.userId, userId),
          eq(savedViews.isShared, true)
        )
      )
      .orderBy(desc(savedViews.createdAt));
  }

  async getSavedView(id: string): Promise<any | undefined> {
    const [view] = await db
      .select()
      .from(savedViews)
      .where(eq(savedViews.id, id));
    return view;
  }

  async createSavedView(viewData: any): Promise<any> {
    const [view] = await db
      .insert(savedViews)
      .values(viewData)
      .returning();
    return view;
  }

  async updateSavedView(id: string, updates: any): Promise<any> {
    const [view] = await db
      .update(savedViews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savedViews.id, id))
      .returning();
    return view;
  }

  async deleteSavedView(id: string): Promise<void> {
    await db.delete(savedViews).where(eq(savedViews.id, id));
  }
}

export const storage = new DatabaseStorage();
