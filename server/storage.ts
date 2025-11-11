import { eq, and, or, desc, asc, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  users,
  channels,
  messages,
  messageMentions,
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
  pushSubscriptions,
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
  getUser(id: string, companyId?: number): Promise<User | undefined>;
  upsertUser(user: any): Promise<User>;
  getAllUsers(companyId?: number): Promise<User[]>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  updateUserRole(userId: string, role: string): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  
  // Channel operations
  getChannels(companyId?: number): Promise<Channel[]>;
  getUserChannels(userId: string, companyId?: number): Promise<Channel[]>;
  getMemberChannels(userId: string, companyId?: number): Promise<Channel[]>;
  getChannel(id: string | number, companyId?: number): Promise<Channel | undefined>;
  createChannel(channel: any, companyId?: number): Promise<Channel>;
  joinChannel(channelId: string | number, userId: string | number): Promise<void>;
  isChannelMember(channelId: string | number, userId: string | number): Promise<boolean>;
  getChannelMembers(channelId: string | number, companyId?: number): Promise<any[]>;
  addChannelMember(channelId: string | number, userId: string | number, companyId?: number): Promise<void>;
  removeChannelMember(channelId: string | number, userId: string | number, companyId?: number): Promise<void>;
  
  // Message operations
  getChannelMessages(channelId: string, companyId?: number, userId?: string): Promise<any[]>;
  getMessage(messageId: string, companyId?: number): Promise<Message | undefined>;
  createMessage(message: any, companyId?: number): Promise<Message>;
  searchMessages(query: string, userId: string, companyId?: number): Promise<any[]>;
  getUserThreads(userId: string, companyId?: number): Promise<any[]>;
  getAllThreads(companyId?: number): Promise<any[]>;
  getAllMessages(userId: string, companyId?: number): Promise<any[]>;
  
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
  
  // Push Subscriptions operations
  savePushSubscription(userId: string, subscription: any): Promise<void>;
  getPushSubscriptions(userId: string): Promise<any[]>;
  deletePushSubscription(userId: string, endpoint: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Helper function to extract numeric user ID from "auth:1" format
  private getUserIdAsNumber(userId: string): number {
    // If userId is already a number string, parse it
    if (/^\d+$/.test(userId)) {
      return parseInt(userId, 10);
    }
    // If userId is in "auth:1" format, extract the number
    if (userId.startsWith('auth:')) {
      const numericId = userId.replace('auth:', '');
      return parseInt(numericId, 10);
    }
    const parsed = parseInt(userId, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid user ID format: ${userId}`);
    }
    return parsed;
  }

  // User operations
  async getUser(id: string | number, companyId?: number): Promise<User | undefined> {
    // Convert "auth:1" format to number if needed
    const userId = typeof id === 'string' ? this.getUserIdAsNumber(id) : id;
    console.log('storage.getUser - input:', id, 'converted:', userId, 'type:', typeof userId, 'companyId:', companyId);
    let query = db.select().from(users).where(eq(users.id, userId));
    if (companyId) {
      query = query.where(and(eq(users.id, userId), eq(users.companyId, companyId))) as any;
    }
    const result = await query.limit(1);
    console.log('storage.getUser - found:', result[0] ? 'yes' : 'no');
    console.log('storage.getUser - result[0]:', result[0]);
    console.log('storage.getUser - result[0] role:', (result[0] as any)?.role);
    console.log('storage.getUser - result[0] keys:', result[0] ? Object.keys(result[0]) : []);
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

  async getAllUsers(companyId?: number): Promise<User[]> {
    if (companyId) {
      return await db.select().from(users).where(eq(users.companyId, companyId));
    }
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
  async getChannels(companyId?: number): Promise<Channel[]> {
    if (companyId) {
      return await db.select().from(channels).where(eq(channels.companyId, companyId)).orderBy(channels.createdAt);
    }
    return await db.select().from(channels).orderBy(channels.createdAt);
  }

  async getUserChannels(userId: string, companyId?: number): Promise<Channel[]> {
    const userIdNum = this.getUserIdAsNumber(userId);
    // Get all public channels and channels where user is a member, filtered by company
    let publicChannelsQuery = db.select().from(channels).where(eq(channels.isPrivate, false));
    if (companyId) {
      publicChannelsQuery = publicChannelsQuery.where(and(eq(channels.isPrivate, false), eq(channels.companyId, companyId))) as any;
    }
    const publicChannels = await publicChannelsQuery;
    
    // Get user's private channels
    let privateQuery = db.select()
      .from(channels)
      .innerJoin(channelMembers, eq(channels.id, channelMembers.channelId))
      .where(and(eq(channelMembers.userId, userIdNum), eq(channels.isPrivate, true)));
    if (companyId) {
      privateQuery = privateQuery.where(and(eq(channelMembers.userId, userIdNum), eq(channels.isPrivate, true), eq(channels.companyId, companyId))) as any;
    }
    const userPrivateChannels = await privateQuery;
    
    // Combine and return unique channels
    const allChannels = [...publicChannels, ...userPrivateChannels.map((c: any) => c.channels)];
    return allChannels;
  }

  async getMemberChannels(userId: string, companyId?: number): Promise<Channel[]> {
    const userIdNum = this.getUserIdAsNumber(userId);
    // Get only channels where user is a member (from channel_members table)
    // Build where condition - combine userId and companyId if provided
    const whereCondition = companyId 
      ? and(eq(channelMembers.userId, userIdNum), eq(channels.companyId, companyId))
      : eq(channelMembers.userId, userIdNum);
    
    const result = await db
      .select()
      .from(channels)
      .innerJoin(channelMembers, eq(channels.id, channelMembers.channelId))
      .where(whereCondition)
      .orderBy(channels.createdAt);
    
    // Extract channels from the join result
    return result.map((row: any) => row.channels).filter(Boolean);
  }

  async getChannel(id: string | number, companyId?: number): Promise<Channel | undefined> {
    const channelId = typeof id === 'string' ? parseInt(id, 10) : id;
    let query = db.select().from(channels).where(eq(channels.id, channelId));
    if (companyId) {
      query = query.where(and(eq(channels.id, channelId), eq(channels.companyId, companyId))) as any;
    }
    const result = await query.limit(1);
    return result[0] || undefined;
  }

  async createChannel(channelData: any, companyId?: number): Promise<Channel> {
    // Remove id if provided since it's AUTO_INCREMENT
    const { id, ...dataWithoutId } = channelData;
    
    // Add companyId if provided
    if (companyId) {
      dataWithoutId.companyId = companyId;
    }
    
    // Insert and get the inserted ID from MySQL
    const result = await db.insert(channels).values(dataWithoutId);
    
    // Get the last inserted ID
    const insertedRows = await db.select().from(channels)
      .where(eq(channels.createdBy, channelData.createdBy))
      .orderBy(desc(channels.createdAt))
      .limit(1);
    
    if (!insertedRows[0]) {
      throw new Error('Failed to create channel');
    }
    return insertedRows[0];
  }

  async joinChannel(channelId: string | number, userId: string | number): Promise<void> {
    // Remove id from data since it's AUTO_INCREMENT
    const channelIdNum = typeof channelId === 'string' ? parseInt(channelId, 10) : channelId;
    const userIdNum = typeof userId === 'string' ? this.getUserIdAsNumber(userId) : userId;
    await db.insert(channelMembers).values({
      channelId: channelIdNum,
      userId: userIdNum,
    });
  }

  async isChannelMember(channelId: string | number, userId: string | number): Promise<boolean> {
    const channelIdNum = typeof channelId === 'string' ? parseInt(channelId, 10) : channelId;
    const userIdNum = typeof userId === 'string' ? this.getUserIdAsNumber(userId) : userId;
    const result = await db.select().from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelIdNum), eq(channelMembers.userId, userIdNum)))
      .limit(1);
    return result.length > 0;
  }

  async getChannelMembers(channelId: string | number, companyId?: number): Promise<any[]> {
    const channelIdNum = typeof channelId === 'string' ? parseInt(channelId, 10) : channelId;
    
    // Build where condition - combine channelId and companyId if provided
    const whereCondition = companyId 
      ? and(eq(channelMembers.channelId, channelIdNum), eq(users.companyId, companyId))
      : eq(channelMembers.channelId, channelIdNum);
    
    const result = await db
      .select({
        id: channelMembers.id,
        userId: channelMembers.userId,
        channelId: channelMembers.channelId,
        joinedAt: channelMembers.joinedAt,
        user: users,
      })
      .from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.id))
      .where(whereCondition);
    
    return result.map(row => ({
      id: row.id,
      userId: row.userId,
      channelId: row.channelId,
      joinedAt: row.joinedAt,
      user: row.user,
    }));
  }

  async addChannelMember(channelId: string | number, userId: string | number, companyId?: number): Promise<void> {
    const channelIdNum = typeof channelId === 'string' ? parseInt(channelId, 10) : channelId;
    const userIdNum = typeof userId === 'string' ? this.getUserIdAsNumber(userId) : userId;
    
    // Verify user belongs to the company if companyId is provided
    if (companyId) {
      const user = await this.getUser(userId, companyId);
      if (!user) {
        throw new Error('User not found in this company');
      }
    }
    
    // Check if member already exists
    const isMember = await this.isChannelMember(channelIdNum, userIdNum);
    if (isMember) {
      throw new Error('User is already a member of this channel');
    }
    
    await db.insert(channelMembers).values({
      channelId: channelIdNum,
      userId: userIdNum,
    });
  }

  async removeChannelMember(channelId: string | number, userId: string | number, companyId?: number): Promise<void> {
    const channelIdNum = typeof channelId === 'string' ? parseInt(channelId, 10) : channelId;
    const userIdNum = typeof userId === 'string' ? this.getUserIdAsNumber(userId) : userId;
    
    // Verify user belongs to the company if companyId is provided
    if (companyId) {
      const user = await this.getUser(userId, companyId);
      if (!user) {
        throw new Error('User not found in this company');
      }
    }
    
    await db.delete(channelMembers)
      .where(and(eq(channelMembers.channelId, channelIdNum), eq(channelMembers.userId, userIdNum)));
  }

  // Message operations
  async getChannelMessages(channelId: string, companyId?: number, userId?: string): Promise<any[]> {
    const channelIdNum = typeof channelId === 'string' ? parseInt(channelId, 10) : channelId;
    
    if (userId) {
      // Use LEFT JOIN to get starred status efficiently
      const userIdNum = this.getUserIdAsNumber(userId);
      let query = db
        .select({
          message: messages,
          user: users,
          starred: starredMessages,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .leftJoin(
          starredMessages,
          and(
            eq(starredMessages.messageId, messages.id),
            eq(starredMessages.userId, userIdNum)
          )
        )
        .where(eq(messages.channelId, channelIdNum));
      
      if (companyId) {
        query = query.where(and(eq(messages.channelId, channelIdNum), eq(messages.companyId, companyId))) as any;
      }
      
      const result = await query.orderBy(asc(messages.createdAt));
      
      // Get reactions for all messages in batch
      const messageIds = result.map(r => r.message.id);
      const allReactions = messageIds.length > 0 ? await this.getMessageReactionsBatch(messageIds) : [];
      
      // Group reactions by messageId
      const reactionsByMessageId = allReactions.reduce((acc: any, reaction: any) => {
        const msgId = reaction.reaction.messageId;
        if (!acc[msgId]) {
          acc[msgId] = [];
        }
        acc[msgId].push({
          ...reaction.reaction,
          user: reaction.user,
        });
        return acc;
      }, {});
      
      return result.map(r => ({
        ...r.message,
        user: r.user,
        isStarred: !!r.starred, // If starred exists, message is starred
        reactions: reactionsByMessageId[r.message.id] || [],
      }));
    } else {
      // No userId, just return messages without starred status
      let query = db
        .select({
          message: messages,
          user: users,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.channelId, channelIdNum));
      
      if (companyId) {
        query = query.where(and(eq(messages.channelId, channelIdNum), eq(messages.companyId, companyId))) as any;
      }
      
      const result = await query.orderBy(asc(messages.createdAt));
      
      // Get reactions for all messages in batch
      const messageIds = result.map(r => r.message.id);
      const allReactions = messageIds.length > 0 ? await this.getMessageReactionsBatch(messageIds) : [];
      
      // Group reactions by messageId
      const reactionsByMessageId = allReactions.reduce((acc: any, reaction: any) => {
        const msgId = reaction.reaction.messageId;
        if (!acc[msgId]) {
          acc[msgId] = [];
        }
        acc[msgId].push({
          ...reaction.reaction,
          user: reaction.user,
        });
        return acc;
      }, {});
      
      return result.map(r => ({
        ...r.message,
        user: r.user,
        isStarred: false,
        reactions: reactionsByMessageId[r.message.id] || [],
      }));
    }
  }

  async getMessageReactionsBatch(messageIds: number[]): Promise<any[]> {
    if (messageIds.length === 0) return [];
    
    const result = await db
      .select({
        reaction: reactions,
        user: users,
      })
      .from(reactions)
      .innerJoin(users, eq(reactions.userId, users.id))
      .where(inArray(reactions.messageId, messageIds))
      .orderBy(asc(reactions.createdAt));
    
    return result;
  }

  async getMessage(messageId: string, companyId?: number): Promise<Message | undefined> {
    const messageIdNum = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
    let query = db.select().from(messages).where(eq(messages.id, messageIdNum));
    if (companyId) {
      query = query.where(and(eq(messages.id, messageIdNum), eq(messages.companyId, companyId))) as any;
    }
    const result = await query.limit(1);
    return result[0] || undefined;
  }

  async createMessage(messageData: any, companyId?: number): Promise<Message> {
    // Remove id if provided since it's AUTO_INCREMENT
    const { id, mentionedUserIds, ...dataWithoutId } = messageData;
    
    // Add companyId if provided
    if (companyId) {
      dataWithoutId.companyId = companyId;
    }
    
    // Remove mentions from JSON field (we'll use message_mentions table instead)
    if (dataWithoutId.mentions) {
      delete dataWithoutId.mentions;
    }
    
    await db.insert(messages).values(dataWithoutId);
    
    // Get the last inserted message
    const result = await db.select().from(messages)
      .where(eq(messages.userId, messageData.userId))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    
    if (!result[0]) {
      throw new Error('Failed to create message');
    }
    
    const createdMessage = result[0];
    
    // Create message mentions if mentionedUserIds provided
    if (mentionedUserIds && Array.isArray(mentionedUserIds) && mentionedUserIds.length > 0) {
      const finalCompanyId = companyId || dataWithoutId.companyId;
      console.log('[createMessage] Creating mentions:', {
        messageId: createdMessage.id,
        mentionedUserIds,
        companyId: finalCompanyId
      });
      await this.createMessageMentions(createdMessage.id, mentionedUserIds, finalCompanyId);
    } else {
      console.log('[createMessage] No mentions to create:', {
        mentionedUserIds,
        isArray: Array.isArray(mentionedUserIds),
        length: mentionedUserIds?.length
      });
    }
    
    return createdMessage;
  }
  
  async createMessageMentions(messageId: number, userIds: number[], companyId: number): Promise<void> {
    if (!userIds || userIds.length === 0) {
      console.log('[createMessageMentions] No userIds provided');
      return;
    }
    
    // Ensure all userIds are numbers
    const numericUserIds = userIds.map(id => {
      const num = typeof id === 'string' ? parseInt(id, 10) : id;
      if (isNaN(num)) {
        console.error('[createMessageMentions] Invalid userId:', id);
        return null;
      }
      return num;
    }).filter((id): id is number => id !== null);
    
    if (numericUserIds.length === 0) {
      console.error('[createMessageMentions] No valid userIds after conversion');
      return;
    }
    
    const mentionData = numericUserIds.map(userId => ({
      messageId,
      userId,
      companyId,
    }));
    
    console.log('[createMessageMentions] Inserting mentions:', mentionData);
    
    try {
      await db.insert(messageMentions).values(mentionData);
      console.log('[createMessageMentions] Mentions created successfully');
    } catch (error) {
      console.error('[createMessageMentions] Error creating mentions:', error);
      throw error;
    }
  }
  
  async getMessageMentions(messageId: number | string): Promise<any[]> {
    const messageIdNum = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
    
    const result = await db
      .select({
        mention: messageMentions,
        user: users,
      })
      .from(messageMentions)
      .innerJoin(users, eq(messageMentions.userId, users.id))
      .where(eq(messageMentions.messageId, messageIdNum));
    
    return result.map(r => ({
      ...r.mention,
      user: r.user,
    }));
  }
  
  async getUserMentions(userId: string | number, companyId?: number): Promise<any[]> {
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
    let query = db
      .select({
        message: messages,
        user: users,
        channel: channels,
        mention: messageMentions,
      })
      .from(messageMentions)
      .innerJoin(messages, eq(messageMentions.messageId, messages.id))
      .innerJoin(users, eq(messages.userId, users.id))
      .leftJoin(channels, eq(messages.channelId, channels.id))
      .where(eq(messageMentions.userId, userIdNum))
      .orderBy(desc(messageMentions.createdAt));
    
    if (companyId) {
      query = query.where(and(eq(messageMentions.userId, userIdNum), eq(messageMentions.companyId, companyId))) as any;
    }
    
    const result = await query;
    
    return result.map(r => ({
      ...r.message,
      user: r.user,
      channel: r.channel,
      mention: r.mention,
    }));
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
    // Fetch user's messages with joined user and channel info
    const base = await db
      .select({
        message: messages,
        user: users,
        channel: channels,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .leftJoin(channels, eq(messages.channelId, channels.id))
      .where(eq(messages.userId, userId))
      .orderBy(desc(messages.createdAt));

    const threads: any[] = [];
    for (const row of base as any[]) {
      // Count replies for each message (thread)
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(eq(messages.threadParentId, row.message.id));
      const replyCount = Number(countResult[0]?.count || 0);

      threads.push({
        ...row.message,
        user: row.user,
        replyCount,
        channel: row.channel ? { id: row.channel.id, name: row.channel.name } : undefined,
      });
    }

    return threads;
  }

  async getAllThreads(companyId?: number): Promise<any[]> {
    try {
      // Build where condition for companyId filter
      let whereCondition: any = sql`${messages.threadParentId} IS NOT NULL`;
      if (companyId !== undefined && companyId !== null) {
        whereCondition = and(
          sql`${messages.threadParentId} IS NOT NULL`,
          eq(messages.companyId, companyId)
        );
      }
      
      // Get unique thread_parent_id values from messages
      // First, get all messages that have thread_parent_id
      const messagesWithThreadParent = await db
        .select({ threadParentId: messages.threadParentId })
        .from(messages)
        .where(whereCondition);

      console.log("Messages with thread_parent_id:", messagesWithThreadParent.length);

      // Extract unique thread parent IDs
      const uniqueThreadParentIds = new Set<number>();
      for (const row of messagesWithThreadParent) {
        if (row.threadParentId !== null && row.threadParentId !== undefined) {
          uniqueThreadParentIds.add(row.threadParentId);
        }
      }

      const threadParentIds = Array.from(uniqueThreadParentIds);
      console.log("Unique thread parent IDs:", threadParentIds);

      if (threadParentIds.length === 0) {
        console.log("No thread parent IDs found");
        return [];
      }

      // Get parent messages with user and channel info
      // Filter by companyId if provided
      let parentMessagesWhere: any = inArray(messages.id, threadParentIds);
      if (companyId !== undefined && companyId !== null) {
        parentMessagesWhere = and(
          inArray(messages.id, threadParentIds),
          eq(messages.companyId, companyId)
        );
      }
      
      const parentMessages = await db
        .select({
          message: messages,
          user: users,
          channel: channels,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .leftJoin(channels, eq(messages.channelId, channels.id))
        .where(parentMessagesWhere)
        .orderBy(desc(messages.createdAt));

      console.log("Parent messages found:", parentMessages.length);

      // Count replies for each parent message
      const threads: any[] = [];
      for (const row of parentMessages as any[]) {
        const countResult = await db.select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(eq(messages.threadParentId, row.message.id));
        const replyCount = Number(countResult[0]?.count || 0);

        threads.push({
          ...row.message,
          user: row.user,
          replyCount,
          channel: row.channel ? { id: row.channel.id, name: row.channel.name } : undefined,
        });
      }

      console.log("Final threads count:", threads.length);
      return threads;
    } catch (error) {
      console.error("Error in getAllThreads:", error);
      throw error;
    }
  }

  async getAllMessages(userId: string): Promise<any[]> {
    return await db.select().from(messages);
  }

  // Direct message operations
  async getDirectMessages(userId1: string, userId2: string): Promise<any[]> {
    // Convert user IDs to numbers
    const userId1Num = this.getUserIdAsNumber(userId1);
    const userId2Num = this.getUserIdAsNumber(userId2);
    
    console.log('[getDirectMessages] Fetching messages between:', {
      userId1,
      userId1Num,
      userId2,
      userId2Num,
    });
    
    const result = await db
      .select({
        dm: directMessages,
        sender: users,
      })
      .from(directMessages)
      .innerJoin(users, eq(directMessages.fromUserId, users.id))
      .where(
        or(
          and(eq(directMessages.fromUserId, userId1Num), eq(directMessages.toUserId, userId2Num)),
          and(eq(directMessages.fromUserId, userId2Num), eq(directMessages.toUserId, userId1Num))
        )
      )
      .orderBy(asc(directMessages.createdAt));

    console.log('[getDirectMessages] Found', result.length, 'messages');
    
    return result.map(r => ({
      ...r.dm,
      sender: r.sender,
    }));
  }

  async createDirectMessage(dmData: any): Promise<any> {
    // Remove id if provided since it's AUTO_INCREMENT
    const { id, ...dataWithoutId } = dmData;
    
    // Ensure companyId is included
    if (!dataWithoutId.companyId) {
      throw new Error('companyId is required for direct messages');
    }
    
    // Log the data being inserted for debugging
    console.log('[createDirectMessage] Creating direct message with data:', {
      fromUserId: dataWithoutId.fromUserId,
      toUserId: dataWithoutId.toUserId,
      companyId: dataWithoutId.companyId,
      content: dataWithoutId.content ? dataWithoutId.content.substring(0, 50) + '...' : '(empty)',
    });
    
    try {
      await db.insert(directMessages).values(dataWithoutId);
      
      // Get the last inserted direct message using both fromUserId and toUserId for better accuracy
      const result = await db.select().from(directMessages)
        .where(
          and(
            eq(directMessages.fromUserId, dataWithoutId.fromUserId),
            eq(directMessages.toUserId, dataWithoutId.toUserId)
          )
        )
        .orderBy(desc(directMessages.createdAt))
        .limit(1);
      
      if (!result[0]) {
        throw new Error('Failed to create direct message - no result returned');
      }
      
      console.log('[createDirectMessage] Direct message created successfully:', result[0].id);
      return result[0];
    } catch (error: any) {
      console.error('[createDirectMessage] Error creating direct message:', error);
      console.error('[createDirectMessage] Error details:', {
        message: error?.message,
        code: error?.code,
        sqlState: error?.sqlState,
        sqlMessage: error?.sqlMessage,
      });
      console.error('[createDirectMessage] Data that failed:', JSON.stringify(dataWithoutId, null, 2));
      throw error;
    }
  }

  // Reaction operations
  async addReaction(reactionData: any): Promise<any> {
    const messageIdNum = typeof reactionData.messageId === 'string' ? parseInt(reactionData.messageId, 10) : reactionData.messageId;
    const userIdNum = typeof reactionData.userId === 'string' ? parseInt(reactionData.userId, 10) : reactionData.userId;

    // Check if user already has ANY reaction on this message (single reaction per user per message)
    const existingReaction = await db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.messageId, messageIdNum),
          eq(reactions.userId, userIdNum)
        )
      )
      .limit(1);
    
    // If user already has a reaction on this message, delete it first
    if (existingReaction.length > 0) {
      await db
        .delete(reactions)
        .where(
          and(
            eq(reactions.messageId, messageIdNum),
            eq(reactions.userId, userIdNum)
          )
        );
    }

    // Remove id if provided since it's AUTO_INCREMENT
    const { id, ...dataWithoutId } = reactionData;

    try {
      await db.insert(reactions).values(dataWithoutId);
    } catch (error: any) {
      // If a unique constraint is later added and we hit a race, return the existing row
      if (error?.code === 'ER_DUP_ENTRY') {
        const dup = await db
          .select()
          .from(reactions)
          .where(
            and(
              eq(reactions.messageId, messageIdNum),
              eq(reactions.userId, userIdNum),
              eq(reactions.icon, reactionData.icon)
            )
          )
          .limit(1);
        return dup[0];
      }
      // Bubble up with code for route mapping (e.g., FK violations)
      throw error;
    }

    // Fetch by the unique triplet to be robust even if IDs are generated by DB
    const result = await db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.messageId, messageIdNum),
          eq(reactions.userId, userIdNum),
          eq(reactions.icon, reactionData.icon)
        )
      )
      .limit(1);
    
    if (!result[0]) {
      console.error("Failed to fetch reaction after insert - messageId:", messageIdNum, "userId:", userIdNum, "icon:", reactionData.icon);
      throw new Error("Failed to retrieve created reaction");
    }
    
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
    // Remove id if provided since it's AUTO_INCREMENT
    const { id, ...dataWithoutId } = notificationData;
    
    // Ensure companyId is included
    if (!dataWithoutId.companyId) {
      throw new Error('companyId is required for notifications');
    }
    
    // Ensure content is not empty (required field)
    if (!dataWithoutId.content) {
      dataWithoutId.content = ''; // Set empty string if content is missing
    }
    
    // Log the data being inserted for debugging
    console.log('Creating notification with data:', {
      userId: dataWithoutId.userId,
      companyId: dataWithoutId.companyId,
      type: dataWithoutId.type,
      messageId: dataWithoutId.messageId,
      channelId: dataWithoutId.channelId,
      fromUserId: dataWithoutId.fromUserId,
      content: dataWithoutId.content ? dataWithoutId.content.substring(0, 50) + '...' : '(empty)',
      isRead: dataWithoutId.isRead,
    });
    
    try {
      // Insert notification - the ID will be auto-generated by MySQL
      // Drizzle ORM will automatically convert camelCase to snake_case
      await db.insert(notifications).values(dataWithoutId);
      
      console.log('Notification created successfully');
      
      // Return the notification data we inserted (ID will be set by MySQL)
      // Full details with joins can be fetched later via getUserNotifications
      return {
        ...dataWithoutId,
      };
    } catch (error: any) {
      console.error('Error creating notification:', error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error sqlState:', error?.sqlState);
      console.error('Error sqlMessage:', error?.sqlMessage);
      console.error('Data that failed:', JSON.stringify(dataWithoutId, null, 2));
      throw error;
    }
  }

  async getUserNotifications(userId: string): Promise<any[]> {
    const userIdNum = this.getUserIdAsNumber(userId);
    
    const result = await db
      .select({
        notification: notifications,
        fromUser: users,
        channel: channels,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.fromUserId, users.id))
      .leftJoin(channels, eq(notifications.channelId, channels.id))
      .where(eq(notifications.userId, userIdNum))
      .orderBy(desc(notifications.createdAt));
    
    return result.map(row => ({
      ...row.notification,
      fromUser: row.fromUser || null,
      channel: row.channel || null,
    }));
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const userIdNum = this.getUserIdAsNumber(userId);
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userIdNum));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const userIdNum = this.getUserIdAsNumber(userId);
      const result = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userIdNum),
            or(eq(notifications.isRead, false), sql`${notifications.isRead} IS NULL`)
          )
        );
      return result.length;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  // Message editing/deletion
  async updateMessage(messageId: string, content: string, mentionedUserIds?: number[]): Promise<Message> {
    const messageIdNum = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
    
    // Get message to get companyId
    const message = await db.select().from(messages).where(eq(messages.id, messageIdNum)).limit(1);
    if (!message[0]) {
      throw new Error('Message not found');
    }
    
    await db
      .update(messages)
      .set({ 
        content, 
        editedAt: new Date(),
      })
      .where(eq(messages.id, messageIdNum));
    
    // Update mentions if provided
    if (mentionedUserIds !== undefined) {
      // Delete existing mentions
      await db.delete(messageMentions).where(eq(messageMentions.messageId, messageIdNum));
      
      // Create new mentions
      if (mentionedUserIds.length > 0) {
        await this.createMessageMentions(messageIdNum, mentionedUserIds, message[0].companyId);
      }
    }
    
    const result = await db.select().from(messages).where(eq(messages.id, messageIdNum)).limit(1);
    return result[0];
  }

  async deleteMessage(messageId: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, messageId));
  }

  // Starred messages operations
  async starMessage(messageId: string, userId: string): Promise<any> {
    try {
      const messageIdNum = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
      if (isNaN(messageIdNum)) {
        throw new Error(`Invalid messageId: ${messageId}`);
      }

      const userIdNum = this.getUserIdAsNumber(userId);
      if (isNaN(userIdNum)) {
        throw new Error(`Invalid userId: ${userId}`);
      }

      console.log('starMessage - Inserting:', { messageId: messageIdNum, userId: userIdNum });

      // Try to insert new star
      await db
        .insert(starredMessages)
        .values({ messageId: messageIdNum, userId: userIdNum });
      
      // Get the inserted record
      const result = await db.select().from(starredMessages)
        .where(and(eq(starredMessages.messageId, messageIdNum), eq(starredMessages.userId, userIdNum)))
        .limit(1);
      return result[0];
    } catch (error: any) {
      // If duplicate key error, return existing record
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_DUP_KEYNAME' || error.message?.includes('Duplicate entry')) {
        const messageIdNum = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
        const userIdNum = this.getUserIdAsNumber(userId);
        const existing = await db.select().from(starredMessages)
          .where(and(eq(starredMessages.messageId, messageIdNum), eq(starredMessages.userId, userIdNum)))
          .limit(1);
        return existing[0];
      }
      console.error("Error in starMessage:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        messageId,
        userId
      });
      throw error;
    }
  }

  async unstarMessage(messageId: string, userId: string): Promise<void> {
    const messageIdNum = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
    const userIdNum = this.getUserIdAsNumber(userId);
    
    await db
      .delete(starredMessages)
      .where(
        and(
          eq(starredMessages.messageId, messageIdNum),
          eq(starredMessages.userId, userIdNum)
        )
      );
  }

  async isMessageStarred(messageId: string, userId: string): Promise<boolean> {
    const messageIdNum = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
    const userIdNum = this.getUserIdAsNumber(userId);
    
    const result = await db
      .select()
      .from(starredMessages)
      .where(
        and(
          eq(starredMessages.messageId, messageIdNum),
          eq(starredMessages.userId, userIdNum)
        )
      );
    
    return result.length > 0;
  }

  async getUserStarredMessages(userId: string): Promise<any[]> {
    const userIdNum = this.getUserIdAsNumber(userId);
    
    const result = await db
      .select({
        message: messages,
        user: users,
      })
      .from(starredMessages)
      .innerJoin(messages, eq(starredMessages.messageId, messages.id))
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(starredMessages.userId, userIdNum))
      .orderBy(desc(starredMessages.createdAt));

    // Get reactions for all starred messages in batch
    const messageIds = result.map(r => r.message.id);
    const allReactions = messageIds.length > 0 ? await this.getMessageReactionsBatch(messageIds) : [];
    
    // Group reactions by messageId
    const reactionsByMessageId = allReactions.reduce((acc: any, reaction: any) => {
      const msgId = reaction.reaction.messageId;
      if (!acc[msgId]) {
        acc[msgId] = [];
      }
      acc[msgId].push({
        ...reaction.reaction,
        user: reaction.user,
      });
      return acc;
    }, {});

    return result.map(r => ({
      ...r.message,
      user: r.user,
      isStarred: true, // All messages here are starred
      reactions: reactionsByMessageId[r.message.id] || [],
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
    // Remove id if provided since it's AUTO_INCREMENT
    const { id, ...dataWithoutId } = drawingData;
    
    await db.insert(drawings).values(dataWithoutId);
    console.log('MySQL insert result:', JSON.stringify(dataWithoutId));
    
    // Get the last inserted record
    const lastInserted = await db.select().from(drawings)
      .where(eq(drawings.createdBy, drawingData.createdBy))
      .orderBy(desc(drawings.createdAt))
      .limit(1);
    
    console.log('Last inserted drawing:', lastInserted[0]);
    
    if (!lastInserted[0]) {
      throw new Error('Failed to create drawing');
    }
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
    // Remove id if provided since it's AUTO_INCREMENT
    const { id, ...dataWithoutId } = revisionData;
    
    await db.insert(drawingRevisions).values(dataWithoutId);
    
    // Get the last inserted revision
    const result = await db.select().from(drawingRevisions)
      .where(eq(drawingRevisions.drawingId, revisionData.drawingId))
      .orderBy(desc(drawingRevisions.createdAt))
      .limit(1);
    
    if (!result[0]) {
      throw new Error('Failed to create drawing revision');
    }
    return result[0];
  }

  async getDrawingRevisions(drawingId: string): Promise<any[]> {
    return await db.select()
      .from(drawingRevisions)
      .where(eq(drawingRevisions.drawingId, drawingId))
      .orderBy(desc(drawingRevisions.uploadedAt));
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
    // Remove id if provided since it's AUTO_INCREMENT
    const { id, ...dataWithoutId } = pageData;
    
    await db.insert(drawingPages).values(dataWithoutId);
    
    // Get the last inserted page
    const result = await db.select().from(drawingPages)
      .where(eq(drawingPages.revisionId, pageData.revisionId))
      .orderBy(desc(drawingPages.createdAt))
      .limit(1);
    
    if (!result[0]) {
      throw new Error('Failed to create drawing page');
    }
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
    // Remove id if provided since it's AUTO_INCREMENT
    const { id, ...dataWithoutId } = layerData;
    
    console.log('Creating layer with data:', dataWithoutId);
    
    try {
      await db.insert(layers).values(dataWithoutId);
      
      // Get the last inserted layer
      const result = await db.select().from(layers)
        .where(eq(layers.drawingId, layerData.drawingId))
        .orderBy(desc(layers.createdAt))
        .limit(1);
      
      console.log('Layer created successfully:', result[0]);
      
      if (!result[0]) {
        throw new Error('Failed to create layer');
      }
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
    // Remove id if provided since it's AUTO_INCREMENT
    const { id, ...dataWithoutId } = pinData;
    
    await db.insert(pins).values(dataWithoutId);
    console.log('MySQL insert pin result:', JSON.stringify(dataWithoutId));
    
    // Get the last inserted record by querying with multiple fields to be more specific
    // Use drawingId + createdBy + createdAt to find the exact pin we just created
    const lastInserted = await db.select().from(pins)
      .where(
        and(
          eq(pins.drawingId, pinData.drawingId),
          eq(pins.createdBy, pinData.createdBy),
          eq(pins.name, pinData.name),
          eq(pins.x, pinData.x),
          eq(pins.y, pinData.y)
        )
      )
      .orderBy(desc(pins.createdAt))
      .limit(1);
    
    console.log('Last inserted pin:', lastInserted[0]);
    
    if (!lastInserted[0]) {
      throw new Error('Failed to create pin - could not retrieve created pin');
    }
    return lastInserted[0];
  }

  async deletePin(pinId: string): Promise<void> {
    await db.delete(pins).where(eq(pins.id, pinId));
  }

  // Tickets operations
  async getTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets);
  }

  async getTicketsFiltered(filters: any): Promise<any> {
    // Defaults
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Number(filters.limit || 20));
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: any[] = [];

    if (filters.search) {
      conditions.push(sql`${tickets.title} LIKE ${'%' + filters.search + '%'}`);
    }
    if (filters.type && Array.isArray(filters.type) && filters.type.length > 0) {
      conditions.push(inArray(tickets.type, filters.type));
    }
    if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
      conditions.push(inArray(tickets.status, filters.status));
    }
    if (filters.priority && Array.isArray(filters.priority) && filters.priority.length > 0) {
      conditions.push(inArray(tickets.priority, filters.priority));
    }
    if (filters.assignedTo && Array.isArray(filters.assignedTo) && filters.assignedTo.length > 0) {
      conditions.push(inArray(tickets.assignedTo, filters.assignedTo));
    }
    if (filters.drawingId && Array.isArray(filters.drawingId) && filters.drawingId.length > 0) {
      conditions.push(inArray(tickets.drawingId, filters.drawingId));
    }
    if (filters.disciplineId && Array.isArray(filters.disciplineId) && filters.disciplineId.length > 0) {
      conditions.push(inArray(tickets.disciplineId, filters.disciplineId));
    }
    if (filters.layerId && Array.isArray(filters.layerId) && filters.layerId.length > 0) {
      conditions.push(inArray(tickets.layerId, filters.layerId));
    }
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
      // tags is a JSON array column; do simple LIKE match for any tag for now
      const likeConds = filters.tags.map((t: string) => sql`JSON_CONTAINS(${tickets.tags}, '"${t}"')`);
      conditions.push(or(...likeConds));
    }
    if (filters.dateFrom) {
      conditions.push(sql`${tickets.createdAt} >= ${new Date(filters.dateFrom)}`);
    }
    if (filters.dateTo) {
      conditions.push(sql`${tickets.createdAt} <= ${new Date(filters.dateTo)}`);
    }

    // Sorting
    const sortBy = (filters.sortBy as string) || 'createdAt';
    const sortOrder = (filters.sortOrder as 'asc' | 'desc') || 'desc';
    const sortColumn: any = (tickets as any)[sortBy] || tickets.createdAt;
    const orderByExpr = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Total count
    const whereExpr = conditions.length > 0 ? and(...conditions) : null;
    const totalSelect = db.select({ count: sql<number>`count(*)` }).from(tickets);
    const totalResult = whereExpr
      ? await totalSelect.where(whereExpr)
      : await totalSelect;
    const total = Number(totalResult[0]?.count || 0);

    // Page of tickets
    const baseSelect = db.select().from(tickets);
    const rows = await (whereExpr ? baseSelect.where(whereExpr) : baseSelect)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset);

    return {
      tickets: rows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getDrawingTickets(drawingId: string): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.drawingId, drawingId));
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    return result[0] || undefined;
  }

  async createTicket(ticketData: any): Promise<Ticket> {
    // Remove id if provided since it's AUTO_INCREMENT
    const { id, ...dataWithoutId } = ticketData;
    
    await db.insert(tickets).values(dataWithoutId);
    console.log('MySQL insert ticket result:', JSON.stringify(dataWithoutId));
    
    // Get the last inserted ticket by querying with multiple fields to be more specific
    // Use title + createdBy + createdAt to find the exact ticket we just created
    const lastInserted = await db.select().from(tickets)
      .where(
        and(
          eq(tickets.createdBy, ticketData.createdBy),
          eq(tickets.title, ticketData.title),
          eq(tickets.type, ticketData.type || 'issue')
        )
      )
      .orderBy(desc(tickets.createdAt))
      .limit(1);
    
    console.log('Last inserted ticket:', lastInserted[0]);
    
    if (!lastInserted[0]) {
      throw new Error('Failed to create ticket - could not retrieve created ticket');
    }
    return lastInserted[0];
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

  // Push Subscriptions operations
  async savePushSubscription(userId: string, subscription: any): Promise<void> {
    const userIdNum = this.getUserIdAsNumber(userId);
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .limit(1);

    if (existing.length > 0) {
      // Update existing subscription
      await db
        .update(pushSubscriptions)
        .set({
          keys: subscription.keys,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    } else {
      // Insert new subscription
      await db.insert(pushSubscriptions).values({
        userId: userIdNum,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      });
    }
  }

  async getPushSubscriptions(userId: string): Promise<any[]> {
    const userIdNum = this.getUserIdAsNumber(userId);
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userIdNum));

    return subscriptions.map((sub) => ({
      endpoint: sub.endpoint,
      keys: sub.keys,
    }));
  }

  async deletePushSubscription(userId: string, endpoint: string): Promise<void> {
    const userIdNum = this.getUserIdAsNumber(userId);
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userIdNum),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );
  }
}

export const storage = new DatabaseStorage();