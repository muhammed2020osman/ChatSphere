import { eq, and, or, desc, asc, sql } from "drizzle-orm";
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

export class DatabaseStorage {
  // User operations
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

  async getUser(id: string): Promise<User | null> {
    return this.getUserById(id);
  }

  // Notification operations
  async getUserNotifications(userId: string): Promise<any[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result.length;
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  // Ticket operations
  async getTicketsFiltered(filters: any): Promise<any[]> {
    return await db.select().from(tickets);
  }

  // Saved views operations
  async getSavedViews(userId: string): Promise<any[]> {
    return await db.select().from(savedViews).where(eq(savedViews.userId, userId));
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  }

  async updateUser(id: string, updates: any): Promise<User | null> {
    await db.update(users).set(updates).where(eq(users.id, id));
    return await this.getUserById(id);
  }

  // Channel operations
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

  async getAllChannels(): Promise<Channel[]> {
    return await db.select().from(channels);
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

  async getChannelById(id: string): Promise<Channel | null> {
    const result = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
    return result[0] || null;
  }

  async getChannel(id: string): Promise<Channel | null> {
    return this.getChannelById(id);
  }

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

  async isChannelMember(channelId: string, userId: string): Promise<boolean> {
    const result = await db.select().from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
      .limit(1);
    return result.length > 0;
  }

  async getAllMessages(userId: string): Promise<any[]> {
    return await db.select().from(messages);
  }

  async getUserThreads(userId: string): Promise<any[]> {
    return await db.select().from(messages).where(eq(messages.userId, userId));
  }

  async getAllDisciplines(): Promise<any[]> {
    return await db.select().from(disciplines);
  }

  async createDiscipline(disciplineData: any): Promise<any> {
    const result = await db.insert(disciplines).values(disciplineData);
    // For MySQL with UUID primary keys, insertId is 0
    // We need to query the last inserted record
    const lastInserted = await db.select().from(disciplines).where(eq(disciplines.name, disciplineData.name)).orderBy(desc(disciplines.createdAt)).limit(1);
    return lastInserted[0];
  }

  async getAllFloors(): Promise<any[]> {
    return await db.select().from(floors);
  }

  async getDrawings(page: number, limit: number): Promise<{
    drawings: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const totalResult = await db.select({ count: sql`count(*)` }).from(drawings);
    const total = totalResult[0]?.count || 0;
    
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

  async getDrawingBySheetNo(sheetNo: string): Promise<any | null> {
    // Search in both name and data.sheetNo
    const result = await db.select().from(drawings).where(
      or(
        eq(drawings.name, sheetNo),
        sql`JSON_EXTRACT(data, '$.sheetNo') = ${sheetNo}`
      )
    ).limit(1);
    return result[0] || null;
  }

  async getDrawingRevisions(drawingId: string): Promise<any[]> {
    return await db.select().from(drawingRevisions).where(eq(drawingRevisions.drawingId, drawingId));
  }

  async createDrawing(drawingData: any): Promise<any> {
    const result = await db.insert(drawings).values(drawingData);
    console.log('MySQL insert result:', JSON.stringify(result));
    // For MySQL with UUID primary keys, insertId is 0
    // We need to query the last inserted record
    const lastInserted = await db.select().from(drawings).where(eq(drawings.createdBy, drawingData.createdBy)).orderBy(desc(drawings.createdAt)).limit(1);
    console.log('Last inserted drawing:', lastInserted[0]);
    return lastInserted[0];
  }

  async getDrawing(id: string): Promise<any | null> {
    const result = await db.select().from(drawings).where(eq(drawings.id, id)).limit(1);
    return result[0] || null;
  }

  async updateChannel(id: string, updates: any): Promise<Channel | null> {
    await db.update(channels).set(updates).where(eq(channels.id, id));
    return await this.getChannelById(id);
  }

  async deleteChannel(id: string): Promise<void> {
    await db.delete(channels).where(eq(channels.id, id));
  }

  // Message operations
  async createMessage(messageData: any): Promise<Message> {
    await db.insert(messages).values(messageData);
    const result = await db.select().from(messages).where(eq(messages.id, messageData.id)).limit(1);
    return result[0];
  }

  async getMessagesByChannel(channelId: string, limit = 50, offset = 0): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getMessageById(id: string): Promise<Message | null> {
    const result = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return result[0] || null;
  }

  async updateMessage(id: string, updates: any): Promise<Message | null> {
    await db.update(messages).set(updates).where(eq(messages.id, id));
    return await this.getMessageById(id);
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }

  // Direct message operations
  async createDirectMessage(dmData: any): Promise<any> {
    await db.insert(directMessages).values(dmData);
    const result = await db.select().from(directMessages).where(eq(directMessages.id, dmData.id)).limit(1);
    return result[0];
  }

  async getDirectMessages(senderId: string, receiverId: string, limit = 50, offset = 0): Promise<any[]> {
    return await db
      .select()
      .from(directMessages)
        .where(
          and(
          eq(directMessages.senderId, senderId),
          eq(directMessages.receiverId, receiverId)
        )
      )
      .orderBy(desc(directMessages.createdAt))
      .limit(limit)
      .offset(offset);
  }


  async getStarredMessagesByUser(userId: string): Promise<any[]> {
    return await db.select().from(starredMessages).where(eq(starredMessages.userId, userId));
  }

  // Channel membership operations
  async joinChannel(channelId: string, userId: string): Promise<void> {
    await db.insert(channelMembers).values({
      id: randomUUID(),
      channelId,
      userId,
    });
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // User operations

  // Drawing revision operations
  async createDrawingRevision(revisionData: any): Promise<any> {
    const result = await db.insert(drawingRevisions).values(revisionData);
    // For MySQL, we need to get the inserted ID from the result
    const insertedId = result.insertId;
    return { id: insertedId };
  }

  // Drawing page operations
  async createDrawingPage(pageData: any): Promise<any> {
    await db.insert(drawingPages).values(pageData);
    const result = await db.select().from(drawingPages).where(eq(drawingPages.drawingId, pageData.drawingId)).orderBy(desc(drawingPages.createdAt)).limit(1);
    return result[0];
  }
}

export const storage = new DatabaseStorage();
