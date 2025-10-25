import { sql, relations } from "drizzle-orm";
import {
  index,
  uniqueIndex,
  mysqlTable,
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
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  email: varchar("email", { length: 255 }).unique(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
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
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isPrivate: boolean("is_private").default(false).notNull(),
  createdBy: varchar("created_by", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages table
export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  content: text("content").notNull(),
  channelId: varchar("channel_id", { length: 191 }).references(() => channels.id),
  userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id),
  replyToId: varchar("reply_to_id", { length: 191 }).references(() => messages.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Drawings table
export const drawings = mysqlTable("drawings", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  data: json("data").notNull(),
  createdBy: varchar("created_by", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Tickets table
export const tickets = mysqlTable("tickets", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("open").notNull(),
  priority: varchar("priority", { length: 50 }).default("medium").notNull(),
  assignedTo: varchar("assigned_to", { length: 191 }).references(() => users.id),
  createdBy: varchar("created_by", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Direct messages table
export const directMessages = mysqlTable("direct_messages", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  content: text("content").notNull(),
  senderId: varchar("sender_id", { length: 191 }).notNull().references(() => users.id),
  receiverId: varchar("receiver_id", { length: 191 }).notNull().references(() => users.id),
  replyToId: varchar("reply_to_id", { length: 191 }).references(() => directMessages.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Channel members table
export const channelMembers = mysqlTable("channel_members", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  channelId: varchar("channel_id", { length: 191 }).notNull().references(() => channels.id),
  userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Reactions table
export const reactions = mysqlTable("reactions", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  messageId: varchar("message_id", { length: 191 }).notNull().references(() => messages.id),
  userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Starred messages table
export const starredMessages = mysqlTable("starred_messages", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  messageId: varchar("message_id", { length: 191 }).notNull().references(() => messages.id),
  userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Attachments table
export const attachments = mysqlTable("attachments", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: varchar("size", { length: 20 }).notNull(),
  url: text("url").notNull(),
  messageId: varchar("message_id", { length: 191 }).references(() => messages.id),
  createdBy: varchar("created_by", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Disciplines table
export const disciplines = mysqlTable("disciplines", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects table
export const projects = mysqlTable("projects", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("active"),
  createdBy: varchar("created_by", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Project members table
export const projectMembers = mysqlTable("project_members", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  projectId: varchar("project_id", { length: 191 }).notNull().references(() => projects.id),
  userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id),
  role: varchar("role", { length: 50 }).default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Drawing pages table
export const drawingPages = mysqlTable("drawing_pages", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  drawingId: varchar("drawing_id", { length: 191 }).notNull().references(() => drawings.id),
  pageNumber: varchar("page_number", { length: 10 }).notNull(),
  data: json("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawing annotations table
export const drawingAnnotations = mysqlTable("drawing_annotations", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  drawingId: varchar("drawing_id", { length: 191 }).notNull().references(() => drawings.id),
  pageId: varchar("page_id", { length: 191 }).references(() => drawingPages.id),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data").notNull(),
  createdBy: varchar("created_by", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawing revisions table
export const drawingRevisions = mysqlTable("drawing_revisions", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  drawingId: varchar("drawing_id", { length: 191 }).notNull().references(() => drawings.id),
  version: varchar("version", { length: 20 }).notNull(),
  changes: json("changes").notNull(),
  createdBy: varchar("created_by", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawing comments table
export const drawingComments = mysqlTable("drawing_comments", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  drawingId: varchar("drawing_id", { length: 191 }).notNull().references(() => drawings.id),
  content: text("content").notNull(),
  x: varchar("x", { length: 20 }),
  y: varchar("y", { length: 20 }),
  createdBy: varchar("created_by", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Floors table
export const floors = mysqlTable("floors", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 100 }).notNull(),
  level: varchar("level", { length: 20 }).notNull(),
  description: text("description"),
  projectId: varchar("project_id", { length: 191 }).references(() => projects.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rooms table
export const rooms = mysqlTable("rooms", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 100 }).notNull(),
  floorId: varchar("floor_id", { length: 191 }).notNull().references(() => floors.id),
  area: varchar("area", { length: 20 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Layers table
export const layers = mysqlTable("layers", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data").notNull(),
  drawingId: varchar("drawing_id", { length: 191 }).notNull().references(() => drawings.id),
  createdBy: varchar("created_by", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawing layers table
export const drawingLayers = mysqlTable("drawing_layers", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  drawingId: varchar("drawing_id", { length: 191 }).notNull().references(() => drawings.id),
  layerId: varchar("layer_id", { length: 191 }).notNull().references(() => layers.id),
  order: varchar("order", { length: 10 }).notNull(),
  visible: boolean("visible").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pins table
export const pins = mysqlTable("pins", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 100 }).notNull(),
  x: varchar("x", { length: 20 }).notNull(),
  y: varchar("y", { length: 20 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data"),
  drawingId: varchar("drawing_id", { length: 191 }).notNull().references(() => drawings.id),
  createdBy: varchar("created_by", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawing pins table
export const drawingPins = mysqlTable("drawing_pins", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  drawingId: varchar("drawing_id", { length: 191 }).notNull().references(() => drawings.id),
  pinId: varchar("pin_id", { length: 191 }).notNull().references(() => pins.id),
  x: varchar("x", { length: 20 }).notNull(),
  y: varchar("y", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved views table
export const savedViews = mysqlTable("saved_views", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data").notNull(),
  userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
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
export type NewUser = typeof users.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Drawing = typeof drawings.$inferSelect;
export type NewDrawing = typeof drawings.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
