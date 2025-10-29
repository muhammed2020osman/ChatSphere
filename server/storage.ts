import { eq, and, or, desc, asc, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
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
  attachments,
  type User,
  type Channel,
  type Message,
  type Drawing,
  type Ticket,
  type Attachment,
} from "@shared/schema";
import { db } from "./db";

export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: any): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  updateUserRole(userId: string, role: string): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  
  // Channel operations
  getChannels(): Promise<Channel[]>;
  getUserChannels(userId: string): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | undefined>;
  createChannel(channel: any): Promise<Channel>;
  joinChannel(channelId: string, userId: string): Promise<void>;
  isChannelMember(channelId: string, userId: string): Promise<boolean>;
  
  // Message operations
  getChannelMessages(channelId: string): Promise<any[]>;
  getMessage(messageId: string): Promise<Message | undefined>;
  createMessage(message: any): Promise<Message>;
  searchMessages(query: string, userId: string): Promise<any[]>;
  getUserThreads(userId: string): Promise<any[]>;
  getAllMessages(userId: string): Promise<any[]>;
  
  // Direct message operations
  getDirectMessages(userId1: string, userId2: string): Promise<any[]>;
  createDirectMessage(dm: any): Promise<any>;
  
  // Reaction operations
  addReaction(reaction: any): Promise<any>;
  removeReaction(messageId: string, userId: string, icon: string): Promise<void>;
  getMessageReactions(messageId: string): Promise<any[]>;
  
  // Notification operations
  createNotification(notification: any): Promise<any>;
  getUserNotifications(userId: string): Promise<any[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  
  // Message editing/deletion
  updateMessage(messageId: string, content: string, mentions?: string[]): Promise<Message>;
  deleteMessage(messageId: string): Promise<void>;
  
  // Starred messages operations
  starMessage(messageId: string, userId: string): Promise<any>;
  unstarMessage(messageId: string, userId: string): Promise<void>;
  isMessageStarred(messageId: string, userId: string): Promise<boolean>;
  getUserStarredMessages(userId: string): Promise<any[]>;
  
  // Drawings operations
  getDisciplines(): Promise<any[]>;
  getFloors(): Promise<any[]>;
  getDrawings(page?: number, limit?: number): Promise<{
    drawings: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  getDrawing(id: string): Promise<any | undefined>;
  getDrawingBySheetNo(sheetNo: string): Promise<any | undefined>;
  createDrawing(drawing: any): Promise<any>;
  createDiscipline(disciplineData: any): Promise<any>;
  createDrawingRevision(revision: any): Promise<any>;
  getDrawingRevisions(drawingId: string): Promise<any[]>;
  updateRevisionStatus(revisionId: string, status: string, reviewedBy: string, reviewNotes?: string): Promise<any>;
  
  // Drawing Pages operations
  createDrawingPage(page: any): Promise<any>;
  getRevisionPages(revisionId: string): Promise<any[]>;
  getDrawingPage(pageId: string): Promise<any | undefined>;
  
  // Layers operations
  getDrawingLayers(drawingId: string): Promise<any[]>;
  createLayer(layer: any): Promise<any>;
  updateLayerVisibility(layerId: string, visible: boolean): Promise<any>;
  deleteLayer(layerId: string): Promise<void>;
  
  // Pins operations
  getDrawingPins(drawingId: string): Promise<any[]>;
  createPin(pin: any): Promise<any>;
  deletePin(pinId: string): Promise<void>;
  
  // Tickets operations
  getTickets(): Promise<Ticket[]>;
  getTicketsFiltered(filters: any): Promise<any>;
  getDrawingTickets(drawingId: string): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: any): Promise<Ticket>;
  updateTicketStatus(ticketId: string, status: string): Promise<Ticket>;
  updateTicket(ticketId: string, updates: any): Promise<Ticket>;
  bulkUpdateTickets(ticketIds: string[], updates: any): Promise<number>;
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
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || undefined;
  }

  async upsertUser(userData: any): Promise<User> {
    const existingUsers = await db.select().from(users);
    const isFirstUser = existingUsers.length === 0;
    
    // Check if user already exists
    const existingUser = await this.getUserById(userData.id);
    if (existingUser) {
      return existingUser;
    }
    
    // Insert new user
    await db
      .insert(users)
      .values({
        ...userData,
        role: isFirstUser ? 'admin' : 'member',
      });
    
    // Get the inserted user
    const insertedUser = await db.select().from(users).where(eq(users.id, userData.id)).limit(1);
    return insertedUser[0];
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
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
    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId));
    
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return result[0];
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  // Channel operations
  async getChannels(): Promise<Channel[]> {
    return await db.select().from(channels).orderBy(channels.createdAt);
  }

  async getUserChannels(userId: string): Promise<Channel[]> {
    // Get all public channels and channels where user is a member
    const publicChannels = await db.select().from(channels).where(eq(channels.isPrivate, false));
    
    // Get user's private channels
    const userPrivateChannels = await db.select()
      .from(channels)
      .innerJoin(channelMembers, eq(channels.id, channelMembers.channelId))
      .where(and(eq(channelMembers.userId, userId), eq(channels.isPrivate, true)));
    
    // Combine and return unique channels
    const allChannels = [...publicChannels, ...userPrivateChannels.map((c: any) => c.channels)];
    return allChannels;
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    const result = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
    return result[0] || undefined;
  }

  async createChannel(channelData: any): Promise<Channel> {
    // Generate ID if not provided
    if (!channelData.id) {
      channelData.id = randomUUID();
    }
    
    await db.insert(channels).values(channelData);
    const result = await db.select().from(channels).where(eq(channels.id, channelData.id)).limit(1);
    if (!result[0]) {
      throw new Error('Failed to create channel');
    }
    return result[0];
  }

  async joinChannel(channelId: string, userId: string): Promise<void> {
    await db.insert(channelMembers).values({
      id: randomUUID(),
      channelId,
      userId,
    });
  }

  async isChannelMember(channelId: string, userId: string): Promise<boolean> {
    const result = await db.select().from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
      .limit(1);
    return result.length > 0;
  }

  // Message operations
  async getChannelMessages(channelId: string): Promise<any[]> {
    const result = await db
      .select({
        message: messages,
        user: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.channelId, channelId))
      .orderBy(asc(messages.createdAt));
    
    return result.map(r => ({
      ...r.message,
      user: r.user,
    }));
  }

  async getMessage(messageId: string): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    return result[0] || undefined;
  }

  async createMessage(messageData: any): Promise<Message> {
    await db.insert(messages).values(messageData);
    const result = await db.select().from(messages).where(eq(messages.id, messageData.id)).limit(1);
    return result[0];
  }

  async searchMessages(query: string, userId: string): Promise<any[]> {
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
        message: messages,
        user: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(
        and(
          sql`${messages.content} LIKE ${'%' + query + '%'}`,
          inArray(messages.channelId, accessibleChannelIds)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(20);

    return result.map(r => ({
      ...r.message,
      user: r.user,
    }));
  }

  async getUserThreads(userId: string): Promise<any[]> {
    return await db.select().from(messages).where(eq(messages.userId, userId));
  }

  async getAllMessages(userId: string): Promise<any[]> {
    return await db.select().from(messages);
  }

  // Direct message operations
  async getDirectMessages(userId1: string, userId2: string): Promise<any[]> {
    const result = await db
      .select({
        dm: directMessages,
        sender: users,
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

    return result.map(r => ({
      ...r.dm,
      sender: r.sender,
    }));
  }

  async createDirectMessage(dmData: any): Promise<any> {
    await db.insert(directMessages).values(dmData);
    const result = await db.select().from(directMessages).where(eq(directMessages.id, dmData.id)).limit(1);
    return result[0];
  }

  // Reaction operations
  async addReaction(reactionData: any): Promise<any> {
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

    await db.insert(reactions).values(reactionData);
    const result = await db.select().from(reactions).where(eq(reactions.id, reactionData.id)).limit(1);
    return result[0];
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

  async getMessageReactions(messageId: string): Promise<any[]> {
    const result = await db
      .select({
        reaction: reactions,
        user: users,
      })
      .from(reactions)
      .innerJoin(users, eq(reactions.userId, users.id))
      .where(eq(reactions.messageId, messageId))
      .orderBy(reactions.createdAt);

    return result.map(r => ({
      ...r.reaction,
      user: r.user,
    }));
  }

  // Notification operations
  async createNotification(notificationData: any): Promise<any> {
    await db.insert(notifications).values(notificationData);
    const result = await db.select().from(notifications).where(eq(notifications.id, notificationData.id)).limit(1);
    return result[0];
  }

  async getUserNotifications(userId: string): Promise<any[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId));
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
    const result = await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result.length;
  }

  // Message editing/deletion
  async updateMessage(messageId: string, content: string, mentions?: string[]): Promise<Message> {
    await db
      .update(messages)
      .set({ 
        content, 
        editedAt: new Date(),
        mentions: mentions || [],
      })
      .where(eq(messages.id, messageId));
    
    const result = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    return result[0];
  }

  async deleteMessage(messageId: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, messageId));
  }

  // Starred messages operations
  async starMessage(messageId: string, userId: string): Promise<any> {
    try {
      // Try to insert new star
      await db
        .insert(starredMessages)
        .values({ messageId, userId });
      
      // Get the inserted record
      const result = await db.select().from(starredMessages)
        .where(and(eq(starredMessages.messageId, messageId), eq(starredMessages.userId, userId)))
        .limit(1);
      return result[0];
    } catch (error: any) {
      // If duplicate key error, return existing record
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_DUP_KEYNAME') {
        const existing = await db.select().from(starredMessages)
          .where(and(eq(starredMessages.messageId, messageId), eq(starredMessages.userId, userId)))
          .limit(1);
        return existing[0];
      }
      throw error;
    }
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
    const result = await db
      .select()
      .from(starredMessages)
      .where(
        and(
          eq(starredMessages.messageId, messageId),
          eq(starredMessages.userId, userId)
        )
      );
    
    return result.length > 0;
  }

  async getUserStarredMessages(userId: string): Promise<any[]> {
    const result = await db
      .select({
        message: messages,
        user: users,
      })
      .from(starredMessages)
      .innerJoin(messages, eq(starredMessages.messageId, messages.id))
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(starredMessages.userId, userId))
      .orderBy(desc(starredMessages.createdAt));

    return result.map(r => ({
      ...r.message,
      user: r.user,
    }));
  }

  // Drawings operations
  async getDisciplines(): Promise<any[]> {
    return await db.select().from(disciplines);
  }

  async getFloors(): Promise<any[]> {
    return await db.select().from(floors);
  }

  async getDrawings(page: number = 1, limit: number = 30): Promise<{
    drawings: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(drawings);
    const total = Number(totalResult[0]?.count || 0);
    
    // Get drawings with pagination
    const drawingsData = await db.select().from(drawings).limit(limit).offset(offset);
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      drawings: drawingsData,
      total,
      page,
      limit,
      totalPages
    };
  }

  async getDrawing(id: string): Promise<any | undefined> {
    const result = await db.select().from(drawings).where(eq(drawings.id, id)).limit(1);
    return result[0] || undefined;
  }

  async getDrawingBySheetNo(sheetNo: string): Promise<any | undefined> {
    // Search in both name and data.sheetNo
    const result = await db.select().from(drawings).where(
      or(
        eq(drawings.name, sheetNo),
        sql`JSON_EXTRACT(data, '$.sheetNo') = ${sheetNo}`
      )
    ).limit(1);
    return result[0] || undefined;
  }

  async createDrawing(drawingData: any): Promise<any> {
    await db.insert(drawings).values(drawingData);
    console.log('MySQL insert result:', JSON.stringify(drawingData));
    // For MySQL with UUID primary keys, insertId is 0
    // We need to query the last inserted record
    const lastInserted = await db.select().from(drawings).where(eq(drawings.createdBy, drawingData.createdBy)).orderBy(desc(drawings.createdAt)).limit(1);
    console.log('Last inserted drawing:', lastInserted[0]);
    return lastInserted[0];
  }

  async createDiscipline(disciplineData: any): Promise<any> {
    await db.insert(disciplines).values(disciplineData);
    // For MySQL with UUID primary keys, insertId is 0
    // We need to query the last inserted record
    const lastInserted = await db.select().from(disciplines).where(eq(disciplines.name, disciplineData.name)).orderBy(desc(disciplines.createdAt)).limit(1);
    return lastInserted[0];
  }

  async createDrawingRevision(revisionData: any): Promise<any> {
    await db.insert(drawingRevisions).values(revisionData);
    // For MySQL, we need to get the inserted ID from the result
    const insertedId = revisionData.id || randomUUID();
    return { id: insertedId };
  }

  async getDrawingRevisions(drawingId: string): Promise<any[]> {
    return await db.select().from(drawingRevisions).where(eq(drawingRevisions.drawingId, drawingId));
  }

  async updateRevisionStatus(revisionId: string, status: string, reviewedBy: string, reviewNotes?: string): Promise<any> {
    await db
      .update(drawingRevisions)
      .set({
        status,
        reviewedBy,
        reviewNotes,
        reviewedAt: new Date(),
      })
      .where(eq(drawingRevisions.id, revisionId));
    
    const result = await db.select().from(drawingRevisions).where(eq(drawingRevisions.id, revisionId)).limit(1);
    return result[0];
  }

  // Drawing Pages operations
  async createDrawingPage(pageData: any): Promise<any> {
    await db.insert(drawingPages).values(pageData);
    const result = await db.select().from(drawingPages).where(eq(drawingPages.revisionId, pageData.revisionId)).orderBy(desc(drawingPages.createdAt)).limit(1);
    return result[0];
  }

  async getRevisionPages(revisionId: string): Promise<any[]> {
    return await db.select().from(drawingPages).where(eq(drawingPages.revisionId, revisionId));
  }

  async getDrawingPage(pageId: string): Promise<any | undefined> {
    const result = await db.select().from(drawingPages).where(eq(drawingPages.id, pageId)).limit(1);
    return result[0] || undefined;
  }

  // Layers operations
  async getDrawingLayers(drawingId: string): Promise<any[]> {
    return await db.select().from(layers).where(eq(layers.drawingId, drawingId));
  }

  async createLayer(layerData: any): Promise<any> {
    // Generate a UUID for the layer
    const layerId = randomUUID();
    const layerWithId = {
      ...layerData,
      id: layerId,
    };
    
    console.log('Creating layer with data:', layerWithId);
    
    try {
      await db.insert(layers).values(layerWithId);
      const result = await db.select().from(layers).where(eq(layers.id, layerId)).limit(1);
      console.log('Layer created successfully:', result[0]);
      return result[0];
    } catch (error) {
      console.error('Error creating layer:', error);
      throw error;
    }
  }

  async updateLayerVisibility(layerId: string, visible: boolean): Promise<any> {
    await db
      .update(layers)
      .set({ visible })
      .where(eq(layers.id, layerId));
    
    const result = await db.select().from(layers).where(eq(layers.id, layerId)).limit(1);
    return result[0];
  }

  async deleteLayer(layerId: string): Promise<void> {
    await db.delete(layers).where(eq(layers.id, layerId));
  }

  // Pins operations
  async getDrawingPins(drawingId: string): Promise<any[]> {
    return await db.select().from(pins).where(eq(pins.drawingId, drawingId));
  }

  async createPin(pinData: any): Promise<any> {
    await db.insert(pins).values(pinData);
    const result = await db.select().from(pins).where(eq(pins.id, pinData.id)).limit(1);
    return result[0];
  }

  async deletePin(pinId: string): Promise<void> {
    await db.delete(pins).where(eq(pins.id, pinId));
  }

  // Tickets operations
  async getTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets);
  }

  async getTicketsFiltered(filters: any): Promise<any> {
    return await db.select().from(tickets);
  }

  async getDrawingTickets(drawingId: string): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.drawingId, drawingId));
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    return result[0] || undefined;
  }

  async createTicket(ticketData: any): Promise<Ticket> {
    await db.insert(tickets).values(ticketData);
    const result = await db.select().from(tickets).where(eq(tickets.id, ticketData.id)).limit(1);
    return result[0];
  }

  async updateTicketStatus(ticketId: string, status: string): Promise<Ticket> {
    await db
      .update(tickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));
    
    const result = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
    return result[0];
  }

  async updateTicket(ticketId: string, updates: any): Promise<Ticket> {
    await db
      .update(tickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));
    
    const result = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
    return result[0];
  }

  async bulkUpdateTickets(ticketIds: string[], updates: any): Promise<number> {
    if (ticketIds.length === 0) {
      return 0;
    }

    await db
      .update(tickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(inArray(tickets.id, ticketIds));

    return ticketIds.length;
  }

  async deleteTicket(ticketId: string): Promise<void> {
    await db.delete(tickets).where(eq(tickets.id, ticketId));
  }

  async getPinTimeline(pinId: string): Promise<any[]> {
    const pinResult = await db.select().from(pins).where(eq(pins.id, pinId)).limit(1);
    if (!pinResult[0]) {
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
      date: pinResult[0].createdAt,
      data: {
        pinId: pinResult[0].id,
        label: pinResult[0].name,
        description: pinResult[0].data,
        createdBy: pinResult[0].createdBy,
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

  // Saved Views operations
  async getSavedViews(userId: string): Promise<any[]> {
    return await db.select().from(savedViews).where(eq(savedViews.userId, userId));
  }

  async getSavedView(id: string): Promise<any | undefined> {
    const result = await db.select().from(savedViews).where(eq(savedViews.id, id)).limit(1);
    return result[0] || undefined;
  }

  async createSavedView(viewData: any): Promise<any> {
    await db.insert(savedViews).values(viewData);
    const result = await db.select().from(savedViews).where(eq(savedViews.id, viewData.id)).limit(1);
    return result[0];
  }

  async updateSavedView(id: string, updates: any): Promise<any> {
    await db
      .update(savedViews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savedViews.id, id));
    
    const result = await db.select().from(savedViews).where(eq(savedViews.id, id)).limit(1);
    return result[0];
  }

  async deleteSavedView(id: string): Promise<void> {
    await db.delete(savedViews).where(eq(savedViews.id, id));
  }
}

export const storage = new DatabaseStorage();