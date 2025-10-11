import {
  users,
  channels,
  messages,
  directMessages,
  channelMembers,
  reactions,
  notifications,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";

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

    // Get messages that the user participated in (either created or replied to)
    const userMessages = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          inArray(messages.channelId, accessibleChannelIds)
        )
      );

    const userMessageIds = userMessages.map(m => m.id);

    if (userMessageIds.length === 0) {
      return [];
    }

    // Get threads where user either started the thread or replied
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
      .where(
        and(
          or(
            inArray(messages.id, userMessageIds),
            inArray(messages.threadParentId, userMessageIds)
          ),
          eq(messages.threadParentId, sql`NULL`)
        )
      )
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
}

export const storage = new DatabaseStorage();
