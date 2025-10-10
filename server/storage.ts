import {
  users,
  channels,
  messages,
  directMessages,
  channelMembers,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  
  // Channel operations
  getChannels(): Promise<Channel[]>;
  getUserChannels(userId: string): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  joinChannel(channelId: string, userId: string): Promise<void>;
  isChannelMember(channelId: string, userId: string): Promise<boolean>;
  
  // Message operations
  getChannelMessages(channelId: string): Promise<MessageWithUser[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  searchMessages(query: string, userId: string): Promise<MessageWithUser[]>;
  
  // Direct message operations
  getDirectMessages(userId1: string, userId2: string): Promise<DirectMessageWithUser[]>;
  createDirectMessage(dm: InsertDirectMessage): Promise<DirectMessage>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
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
        threadParentId: messages.threadParentId,
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
      threadParentId: row.threadParentId,
      createdAt: row.createdAt,
      user: row.user,
    }));
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
        threadParentId: messages.threadParentId,
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
      threadParentId: row.threadParentId,
      createdAt: row.createdAt,
      user: row.user,
    }));
  }

  // Direct message operations
  async getDirectMessages(userId1: string, userId2: string): Promise<DirectMessageWithUser[]> {
    const result = await db
      .select({
        id: directMessages.id,
        fromUserId: directMessages.fromUserId,
        toUserId: directMessages.toUserId,
        content: directMessages.content,
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
      createdAt: row.createdAt,
      sender: row.sender,
      recipient: row.sender, // Will be updated by API layer if needed
    }));
  }

  async createDirectMessage(dmData: InsertDirectMessage): Promise<DirectMessage> {
    const [dm] = await db.insert(directMessages).values(dmData).returning();
    return dm;
  }
}

export const storage = new DatabaseStorage();
