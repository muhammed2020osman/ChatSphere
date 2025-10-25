import { eq, and, desc, asc, sql } from "drizzle-orm";
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
  type Drawing,
  type InsertDrawing,
  type Ticket,
  type InsertTicket,
  type Attachment,
  type InsertAttachment,
} from "@shared/schema";
import { db } from "./db";

export class DatabaseStorage {
  // User operations
  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUsers = await db.select().from(users);
    const isFirstUser = existingUsers.length === 0;
    
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | null> {
    await db.update(users).set(updates).where(eq(users.id, id));
    return await this.getUserById(id);
  }

  // Channel operations
  async createChannel(channelData: InsertChannel): Promise<Channel> {
    await db.insert(channels).values(channelData);
    const result = await db.select().from(channels).where(eq(channels.id, channelData.id)).limit(1);
    return result[0];
  }

  async getAllChannels(): Promise<Channel[]> {
    return await db.select().from(channels);
  }

  async getChannelById(id: string): Promise<Channel | null> {
    const result = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
    return result[0] || null;
  }

  async updateChannel(id: string, updates: Partial<InsertChannel>): Promise<Channel | null> {
    await db.update(channels).set(updates).where(eq(channels.id, id));
    return await this.getChannelById(id);
  }

  async deleteChannel(id: string): Promise<void> {
    await db.delete(channels).where(eq(channels.id, id));
  }

  // Message operations
  async createMessage(messageData: InsertMessage): Promise<Message> {
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

  async updateMessage(id: string, updates: Partial<InsertMessage>): Promise<Message | null> {
    await db.update(messages).set(updates).where(eq(messages.id, id));
    return await this.getMessageById(id);
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }

  // Direct message operations
  async createDirectMessage(dmData: InsertDirectMessage): Promise<DirectMessage> {
    await db.insert(directMessages).values(dmData);
    const result = await db.select().from(directMessages).where(eq(directMessages.id, dmData.id)).limit(1);
    return result[0];
  }

  async getDirectMessages(senderId: string, receiverId: string, limit = 50, offset = 0): Promise<DirectMessage[]> {
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

  // Drawing operations
  async createDrawing(drawingData: InsertDrawing): Promise<Drawing> {
    await db.insert(drawings).values(drawingData);
    const result = await db.select().from(drawings).where(eq(drawings.id, drawingData.id)).limit(1);
    return result[0];
  }

  async getAllDrawings(): Promise<Drawing[]> {
    return await db.select().from(drawings);
  }

  async getDrawingById(id: string): Promise<Drawing | null> {
    const result = await db.select().from(drawings).where(eq(drawings.id, id)).limit(1);
    return result[0] || null;
  }

  async updateDrawing(id: string, updates: Partial<InsertDrawing>): Promise<Drawing | null> {
    await db.update(drawings).set(updates).where(eq(drawings.id, id));
    return await this.getDrawingById(id);
  }

  async deleteDrawing(id: string): Promise<void> {
    await db.delete(drawings).where(eq(drawings.id, id));
  }

  // Ticket operations
  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    await db.insert(tickets).values(ticketData);
    const result = await db.select().from(tickets).where(eq(tickets.id, ticketData.id)).limit(1);
    return result[0];
  }

  async getAllTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets);
  }

  async getTicketById(id: string): Promise<Ticket | null> {
    const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    return result[0] || null;
  }

  async updateTicket(id: string, updates: Partial<InsertTicket>): Promise<Ticket | null> {
    await db.update(tickets).set(updates).where(eq(tickets.id, id));
    return await this.getTicketById(id);
  }

  async deleteTicket(id: string): Promise<void> {
    await db.delete(tickets).where(eq(tickets.id, id));
  }

  // Attachment operations
  async createAttachment(attachmentData: InsertAttachment): Promise<Attachment> {
    await db.insert(attachments).values(attachmentData);
    const result = await db.select().from(attachments).where(eq(attachments.id, attachmentData.id)).limit(1);
    return result[0];
  }

  async getAttachmentsByMessage(messageId: string): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.messageId, messageId));
  }

  async deleteAttachment(id: string): Promise<void> {
    await db.delete(attachments).where(eq(attachments.id, id));
  }

  // Reaction operations
  async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    await db.insert(reactions).values({
      id: crypto.randomUUID(),
      messageId,
      userId,
      emoji,
      createdAt: new Date(),
    });
  }

  async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    await db.delete(reactions).where(
      and(
        eq(reactions.messageId, messageId),
        eq(reactions.userId, userId),
        eq(reactions.emoji, emoji)
      )
    );
  }

  async getReactionsByMessage(messageId: string): Promise<any[]> {
    return await db.select().from(reactions).where(eq(reactions.messageId, messageId));
  }

  // Notification operations
  async createNotification(userId: string, type: string, title: string, message: string): Promise<void> {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId,
      type,
      title,
      message,
      isRead: false,
      createdAt: new Date(),
    });
  }

  async getNotificationsByUser(userId: string): Promise<any[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  // Starred message operations
  async starMessage(messageId: string, userId: string): Promise<void> {
    await db.insert(starredMessages).values({
      id: crypto.randomUUID(),
      messageId,
      userId,
      createdAt: new Date(),
    });
  }

  async unstarMessage(messageId: string, userId: string): Promise<void> {
    await db.delete(starredMessages).where(
      and(
        eq(starredMessages.messageId, messageId),
        eq(starredMessages.userId, userId)
      )
    );
  }

  async getStarredMessagesByUser(userId: string): Promise<any[]> {
    return await db.select().from(starredMessages).where(eq(starredMessages.userId, userId));
  }
}

export const storage = new DatabaseStorage();
