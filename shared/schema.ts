import { sql, relations } from "drizzle-orm";
import {
  index,
  uniqueIndex,
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  boolean,
  json,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - Required for Replit Auth
export const sessions = mysqlTable(
  "sessions",
  {
    sid: varchar("sid", { length: 191 }).primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - Required for Replit Auth
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  profileImageUrl: text("profile_image_url"),
  status: varchar("status", { length: 50 }),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen"),
  role: varchar("role", { length: 20 }).default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Channels table
export const channels = mysqlTable("channels", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isPrivate: boolean("is_private").default(false).notNull(),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages table
export const messages = mysqlTable("messages", {
  id: int("id").primaryKey().autoincrement(),
  content: text("content").notNull(),
  channelId: int("channel_id").references(() => channels.id),
  userId: int("user_id").notNull().references(() => users.id),
  replyToId: int("reply_to_id"),
  attachmentUrl: text("attachment_url"),
  attachmentType: varchar("attachment_type", { length: 100 }),
  attachmentName: varchar("attachment_name", { length: 255 }),
  threadParentId: int("thread_parent_id"),
  mentions: json("mentions").default([]),
  editedAt: timestamp("edited_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Drawings table
export const drawings = mysqlTable("drawings", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  data: json("data").notNull(),
  disciplineId: int("discipline_id").references(() => disciplines.id),
  floorId: int("floor_id").references(() => floors.id),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Tickets table
export const tickets = mysqlTable("tickets", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).default("issue").notNull(),
  status: varchar("status", { length: 50 }).default("open").notNull(),
  priority: varchar("priority", { length: 50 }).default("medium").notNull(),
  drawingId: int("drawing_id").references(() => drawings.id),
  disciplineId: int("discipline_id").references(() => disciplines.id),
  pinId: int("pin_id").references(() => pins.id),
  layerId: int("layer_id").references(() => layers.id),
  assignedTo: int("assigned_to").references(() => users.id),
  createdBy: int("created_by").notNull().references(() => users.id),
  reporter: int("reporter").references(() => users.id),
  channelId: int("channel_id").references(() => channels.id),
  slaHours: varchar("sla_hours", { length: 10 }),
  dueDate: timestamp("due_date"),
  tags: json("tags").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Direct messages table
export const directMessages = mysqlTable("direct_messages", {
  id: int("id").primaryKey().autoincrement(),
  content: text("content").notNull(),
  fromUserId: int("from_user_id").notNull().references(() => users.id),
  toUserId: int("to_user_id").notNull().references(() => users.id),
  replyToId: int("reply_to_id"),
  attachmentUrl: text("attachment_url"),
  attachmentType: varchar("attachment_type", { length: 100 }),
  attachmentName: varchar("attachment_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Channel members table
export const channelMembers = mysqlTable("channel_members", {
  id: int("id").primaryKey().autoincrement(),
  channelId: int("channel_id").notNull().references(() => channels.id),
  userId: int("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Reactions table
export const reactions = mysqlTable("reactions", {
  id: int("id").primaryKey().autoincrement(),
  messageId: int("message_id").notNull().references(() => messages.id),
  userId: int("user_id").notNull().references(() => users.id),
  icon: varchar("icon", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
export const notifications = mysqlTable("notifications", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  messageId: int("message_id").references(() => messages.id),
  channelId: int("channel_id").references(() => channels.id),
  fromUserId: int("from_user_id").references(() => users.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Starred messages table
export const starredMessages = mysqlTable("starred_messages", {
  id: int("id").primaryKey().autoincrement(),
  messageId: int("message_id").notNull().references(() => messages.id),
  userId: int("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Attachments table
export const attachments = mysqlTable("attachments", {
  id: int("id").primaryKey().autoincrement(),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: varchar("size", { length: 20 }).notNull(),
  url: text("url").notNull(),
  messageId: int("message_id").references(() => messages.id),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Disciplines table
export const disciplines = mysqlTable("disciplines", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  code: varchar("code", { length: 20 }),
  color: varchar("color", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects table
export const projects = mysqlTable("projects", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("active"),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Project members table
export const projectMembers = mysqlTable("project_members", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull().references(() => projects.id),
  userId: int("user_id").notNull().references(() => users.id),
  role: varchar("role", { length: 50 }).default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Drawing pages table
export const drawingPages = mysqlTable("drawing_pages", {
  id: int("id").primaryKey().autoincrement(),
  revisionId: int("revision_id").notNull().references(() => drawingRevisions.id),
  pageNumber: varchar("page_number", { length: 10 }).notNull(),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  extractedText: text("extracted_text"),
  extractedMetadata: json("extracted_metadata"),
  aiExtractedData: json("ai_extracted_data"),
  width: varchar("width", { length: 20 }),
  height: varchar("height", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawing annotations table
export const drawingAnnotations = mysqlTable("drawing_annotations", {
  id: int("id").primaryKey().autoincrement(),
  drawingId: int("drawing_id").notNull().references(() => drawings.id),
  pageId: int("page_id").references(() => drawingPages.id),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data").notNull(),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawing revisions table
export const drawingRevisions = mysqlTable("drawing_revisions", {
  id: int("id").primaryKey().autoincrement(),
  drawingId: int("drawing_id").notNull().references(() => drawings.id),
  version: varchar("version", { length: 20 }).notNull(),
  changes: json("changes").notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(),
  fileUrl: text("file_url"),
  thumbnailUrl: text("thumbnail_url"),
  fileName: varchar("file_name", { length: 255 }),
  fileType: varchar("file_type", { length: 100 }),
  fileSize: varchar("file_size", { length: 20 }),
  aiExtractedData: json("ai_extracted_data"),
  uploadedBy: int("uploaded_by").references(() => users.id),
  reviewedBy: int("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawing comments table
export const drawingComments = mysqlTable("drawing_comments", {
  id: int("id").primaryKey().autoincrement(),
  drawingId: int("drawing_id").notNull().references(() => drawings.id),
  content: text("content").notNull(),
  x: varchar("x", { length: 20 }),
  y: varchar("y", { length: 20 }),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Floors table
export const floors = mysqlTable("floors", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  level: varchar("level", { length: 20 }).notNull(),
  description: text("description"),
  projectId: int("project_id").references(() => projects.id),
  sortOrder: varchar("sort_order", { length: 10 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rooms table
export const rooms = mysqlTable("rooms", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  floorId: int("floor_id").notNull().references(() => floors.id),
  area: varchar("area", { length: 20 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Layers table
export const layers = mysqlTable("layers", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data").notNull(),
  drawingId: int("drawing_id").notNull().references(() => drawings.id),
  visible: boolean("visible").default(true),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawing layers table
export const drawingLayers = mysqlTable("drawing_layers", {
  id: int("id").primaryKey().autoincrement(),
  drawingId: int("drawing_id").notNull().references(() => drawings.id),
  layerId: int("layer_id").notNull().references(() => layers.id),
  order: varchar("order", { length: 10 }).notNull(),
  visible: boolean("visible").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pins table
export const pins = mysqlTable("pins", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  x: varchar("x", { length: 20 }).notNull(),
  y: varchar("y", { length: 20 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data"),
  drawingId: int("drawing_id").notNull().references(() => drawings.id),
  layerId: int("layer_id").references(() => layers.id),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawing pins table
export const drawingPins = mysqlTable("drawing_pins", {
  id: int("id").primaryKey().autoincrement(),
  drawingId: int("drawing_id").notNull().references(() => drawings.id),
  pinId: int("pin_id").notNull().references(() => pins.id),
  x: varchar("x", { length: 20 }).notNull(),
  y: varchar("y", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved views table
export const savedViews = mysqlTable("saved_views", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data").notNull(),
  userId: int("user_id").notNull().references(() => users.id),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});


// Relations
export const usersRelations = relations(users, ({ many }) => ({
  channels: many(channels),
  messages: many(messages),
  drawings: many(drawings),
  tickets: many(tickets),
  attachments: many(attachments),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [channels.createdBy],
    references: [users.id],
  }),
  members: many(channelMembers),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
  }),
  attachments: many(attachments),
}));

export const drawingsRelations = relations(drawings, ({ one }) => ({
  createdBy: one(users, {
    fields: [drawings.createdBy],
    references: [users.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  assignedTo: one(users, {
    fields: [tickets.assignedTo],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [tickets.createdBy],
    references: [users.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  message: one(messages, {
    fields: [attachments.messageId],
    references: [messages.id],
  }),
  createdBy: one(users, {
    fields: [attachments.createdBy],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
export const insertChannelSchema = createInsertSchema(channels);
export const insertMessageSchema = createInsertSchema(messages);
export const insertDirectMessageSchema = createInsertSchema(directMessages);
export const insertDrawingSchema = createInsertSchema(drawings);
export const insertTicketSchema = createInsertSchema(tickets);
export const insertAttachmentSchema = createInsertSchema(attachments);
export const insertDrawingPageSchema = createInsertSchema(drawingPages);
export const insertDrawingRevisionSchema = createInsertSchema(drawingRevisions);
export const insertDrawingAnnotationSchema = createInsertSchema(drawingAnnotations);
export const insertDrawingCommentSchema = createInsertSchema(drawingComments);
export const insertDisciplineSchema = createInsertSchema(disciplines);
export const insertProjectSchema = createInsertSchema(projects);
export const insertFloorSchema = createInsertSchema(floors);
export const insertRoomSchema = createInsertSchema(rooms);
export const insertLayerSchema = createInsertSchema(layers);
export const insertPinSchema = createInsertSchema(pins);
export const insertSavedViewSchema = createInsertSchema(savedViews);
export const insertReactionSchema = createInsertSchema(reactions);
export const insertNotificationSchema = createInsertSchema(notifications);
export const insertStarredMessageSchema = createInsertSchema(starredMessages);
export const insertChannelMemberSchema = createInsertSchema(channelMembers);
export const insertProjectMemberSchema = createInsertSchema(projectMembers);
export const insertDrawingLayerSchema = createInsertSchema(drawingLayers);
export const insertDrawingPinSchema = createInsertSchema(drawingPins);

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = typeof channels.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type DirectMessage = typeof directMessages.$inferSelect;
export type InsertDirectMessage = typeof directMessages.$inferInsert;
export type InsertChannelMember = typeof channelMembers.$inferInsert;
export type MessageWithUser = Message & { user: User };
export type DirectMessageWithUser = DirectMessage & { sender: User };
export type Reaction = typeof reactions.$inferSelect;
export type InsertReaction = typeof reactions.$inferInsert;
export type ReactionWithUser = Reaction & { user: User };
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type NotificationWithUsers = Notification & { fromUser: User; channel?: Channel };
export type StarredMessage = typeof starredMessages.$inferSelect;
export type InsertStarredMessage = typeof starredMessages.$inferInsert;
export type Drawing = typeof drawings.$inferSelect;
export type InsertDrawing = typeof drawings.$inferInsert;
export type DrawingRevision = typeof drawingRevisions.$inferSelect;
export type InsertDrawingRevision = typeof drawingRevisions.$inferInsert;
export type DrawingPage = typeof drawingPages.$inferSelect;
export type InsertDrawingPage = typeof drawingPages.$inferInsert;
export type DrawingWithDetails = Drawing & { 
  discipline: Discipline; 
  floor?: Floor; 
  creator: User; 
  revisionCount: number;
  latestRevision?: DrawingRevision & { uploader: User; reviewer?: User };
  revisions?: (DrawingRevision & { uploader: User; reviewer?: User })[];
};
export type Discipline = typeof disciplines.$inferSelect;
export type Floor = typeof floors.$inferSelect;
export type Layer = typeof layers.$inferSelect;
export type InsertLayer = typeof layers.$inferInsert;
export type Pin = typeof pins.$inferSelect;
export type InsertPin = typeof pins.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;
export type SavedView = typeof savedViews.$inferSelect;
export type InsertSavedView = typeof savedViews.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;
