import { sql, relations } from "drizzle-orm";
import {
  index,
  uniqueIndex,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - Required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  status: varchar("status", { length: 100 }),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen"),
  role: varchar("role", { length: 20 }).default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Channels table
export const channels = pgTable("channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 80 }).notNull(),
  description: text("description"),
  isPrivate: boolean("is_private").default(false).notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Channel members table
export const channelMembers = pgTable("channel_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content"),
  attachmentUrl: varchar("attachment_url"),
  attachmentType: varchar("attachment_type", { length: 50 }),
  attachmentName: varchar("attachment_name"),
  threadParentId: varchar("thread_parent_id"),
  mentions: text("mentions").array(),
  editedAt: timestamp("edited_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Direct messages table
export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: varchar("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content"),
  attachmentUrl: varchar("attachment_url"),
  attachmentType: varchar("attachment_type", { length: 50 }),
  attachmentName: varchar("attachment_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reactions table
export const reactions = pgTable("reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  icon: varchar("icon", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table - for @mentions and other notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // 'mention', 'reply', 'reaction'
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  channelId: varchar("channel_id").references(() => channels.id, { onDelete: "cascade" }),
  fromUserId: varchar("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Starred messages table
export const starredMessages = pgTable("starred_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Ensure user can only star a message once
  uniqueUserMessage: uniqueIndex("unique_user_message").on(table.messageId, table.userId),
}));

// Saved Views table - User-defined views for tickets
export const savedViews = pgTable("saved_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  filters: jsonb("filters").notNull(), // JSON object with all filter values
  columns: text("columns").array(), // Array of column names to show
  sortBy: varchar("sort_by", { length: 50 }), // Column to sort by
  sortOrder: varchar("sort_order", { length: 10 }), // "asc" or "desc"
  viewType: varchar("view_type", { length: 20 }).notNull().default("table"), // "table" or "map"
  isDefault: boolean("is_default").default(false).notNull(), // Is this the user's default view?
  isShared: boolean("is_shared").default(false).notNull(), // Can other users see this view?
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Disciplines table - Engineering disciplines (ARCH, STR, MEP, GEN)
export const disciplines = pgTable("disciplines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 10 }).unique().notNull(), // e.g., "ARCH", "STR", "MEP", "GEN"
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Architectural", "Structural"
  icon: varchar("icon", { length: 50 }), // Icon name for UI
  color: varchar("color", { length: 20 }), // Color code for UI
});

// Floors table - Building floors/levels
export const floors = pgTable("floors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 20 }).unique().notNull(), // e.g., "G", "01", "02", "B1"
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Ground Floor", "Level 01"
  sortOrder: varchar("sort_order", { length: 10 }), // For proper sorting (e.g., "01", "02")
});

// Drawings table - Main drawing documents
export const drawings = pgTable("drawings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sheetNo: varchar("sheet_no", { length: 50 }).unique().notNull(), // e.g., "A-101", "S-201"
  title: varchar("title", { length: 255 }).notNull(),
  disciplineId: varchar("discipline_id").notNull().references(() => disciplines.id),
  floorId: varchar("floor_id").references(() => floors.id),
  packageName: varchar("package_name", { length: 100 }), // e.g., "Core and Shell", "MEP"
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  updatedAtIdx: index("drawings_updated_at_idx").on(table.updatedAt),
  disciplineIdx: index("drawings_discipline_id_idx").on(table.disciplineId),
  floorIdx: index("drawings_floor_id_idx").on(table.floorId),
}));

// Drawing Revisions table - Version history for each drawing
export const drawingRevisions = pgTable("drawing_revisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  drawingId: varchar("drawing_id").notNull().references(() => drawings.id, { onDelete: "cascade" }),
  revisionNo: varchar("revision_no", { length: 50 }).notNull(), // e.g., "A", "B", "C", "0", "1", or auto-generated "R1_abc123de"
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, under_review, approved, rejected, superseded
  fileUrl: varchar("file_url").notNull(), // Object storage URL
  thumbnailUrl: varchar("thumbnail_url"), // Thumbnail image URL for preview
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type", { length: 50 }), // e.g., "application/pdf"
  fileSize: varchar("file_size"), // In bytes
  uploadMethod: varchar("upload_method", { length: 20 }).notNull().default("ai"), // 'ai' or 'manual' - distinguishes AI-assisted vs manual upload
  aiExtractedData: jsonb("ai_extracted_data"), // AI-extracted metadata from Gemini (layers, dimensions, elements)
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
}, (table) => ({
  // Ensure unique revision number per drawing
  uniqueDrawingRevision: uniqueIndex("unique_drawing_revision").on(table.drawingId, table.revisionNo),
  // Performance indexes
  drawingIdIdx: index("revisions_drawing_id_idx").on(table.drawingId),
  uploadedAtIdx: index("revisions_uploaded_at_idx").on(table.uploadedAt),
}));

// Drawing Pages table - Individual pages within multi-page PDF revisions
export const drawingPages = pgTable("drawing_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  revisionId: varchar("revision_id").notNull().references(() => drawingRevisions.id, { onDelete: "cascade" }),
  pageNumber: varchar("page_number", { length: 10 }).notNull(), // 1, 2, 3, etc.
  imageUrl: varchar("image_url").notNull(), // PNG image URL for this page
  thumbnailUrl: varchar("thumbnail_url"), // Smaller thumbnail for navigation
  extractedText: text("extracted_text"), // Text extracted from this page via pdf-parse
  extractedMetadata: jsonb("extracted_metadata"), // Metadata from text extraction (sheet numbers, room names, dimensions)
  aiExtractedData: jsonb("ai_extracted_data"), // AI-extracted data from Gemini Vision for this page
  width: varchar("width", { length: 20 }), // Image width in pixels
  height: varchar("height", { length: 20 }), // Image height in pixels
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Ensure unique page number per revision
  uniqueRevisionPage: uniqueIndex("unique_revision_page").on(table.revisionId, table.pageNumber),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  channelsCreated: many(channels),
  channelMemberships: many(channelMembers),
  messages: many(messages),
  directMessagesSent: many(directMessages, { relationName: "sentMessages" }),
  directMessagesReceived: many(directMessages, { relationName: "receivedMessages" }),
  reactions: many(reactions),
  notifications: many(notifications),
  notificationsSent: many(notifications, { relationName: "notificationSender" }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  creator: one(users, {
    fields: [channels.createdBy],
    references: [users.id],
  }),
  members: many(channelMembers),
  messages: many(messages),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, {
    fields: [channelMembers.channelId],
    references: [channels.id],
  }),
  user: one(users, {
    fields: [channelMembers.userId],
    references: [users.id],
  }),
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
  threadParent: one(messages, {
    fields: [messages.threadParentId],
    references: [messages.id],
    relationName: "threadReplies",
  }),
  threadReplies: many(messages, { relationName: "threadReplies" }),
  reactions: many(reactions),
}));

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  sender: one(users, {
    fields: [directMessages.fromUserId],
    references: [users.id],
    relationName: "sentMessages",
  }),
  recipient: one(users, {
    fields: [directMessages.toUserId],
    references: [users.id],
    relationName: "receivedMessages",
  }),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  message: one(messages, {
    fields: [reactions.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [reactions.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  fromUser: one(users, {
    fields: [notifications.fromUserId],
    references: [users.id],
    relationName: "notificationSender",
  }),
  message: one(messages, {
    fields: [notifications.messageId],
    references: [messages.id],
  }),
  channel: one(channels, {
    fields: [notifications.channelId],
    references: [channels.id],
  }),
}));

export const drawingsRelations = relations(drawings, ({ one, many }) => ({
  discipline: one(disciplines, {
    fields: [drawings.disciplineId],
    references: [disciplines.id],
  }),
  floor: one(floors, {
    fields: [drawings.floorId],
    references: [floors.id],
  }),
  creator: one(users, {
    fields: [drawings.createdBy],
    references: [users.id],
  }),
  revisions: many(drawingRevisions),
}));

export const drawingRevisionsRelations = relations(drawingRevisions, ({ one, many }) => ({
  drawing: one(drawings, {
    fields: [drawingRevisions.drawingId],
    references: [drawings.id],
  }),
  uploader: one(users, {
    fields: [drawingRevisions.uploadedBy],
    references: [users.id],
    relationName: "revisionUploader",
  }),
  reviewer: one(users, {
    fields: [drawingRevisions.reviewedBy],
    references: [users.id],
    relationName: "revisionReviewer",
  }),
  pages: many(drawingPages),
}));

export const drawingPagesRelations = relations(drawingPages, ({ one }) => ({
  revision: one(drawingRevisions, {
    fields: [drawingPages.revisionId],
    references: [drawingRevisions.id],
  }),
}));

// Layers table - Drawing layers (pins, annotations, drawings)
export const layers = pgTable("layers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  drawingId: varchar("drawing_id").notNull().references(() => drawings.id, { onDelete: "cascade" }),
  disciplineId: varchar("discipline_id").notNull().references(() => disciplines.id),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "Architectural Pins", "MEP Annotations"
  type: varchar("type", { length: 50 }).notNull(), // "pin", "drawing", "annotation"
  visible: boolean("visible").default(true).notNull(),
  data: jsonb("data"), // Store drawing data (shapes, lines, etc.) as JSON
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pins table - Location markers on drawings
export const pins = pgTable("pins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  drawingId: varchar("drawing_id").notNull().references(() => drawings.id, { onDelete: "cascade" }),
  layerId: varchar("layer_id").references(() => layers.id, { onDelete: "cascade" }), // Optional - some drawings don't have layers
  x: varchar("x", { length: 20 }).notNull(), // Percentage position (0-100)
  y: varchar("y", { length: 20 }).notNull(), // Percentage position (0-100)
  label: varchar("label", { length: 100 }), // Optional label for the pin
  description: text("description"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tickets table - Issues/tasks linked to pins
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull().default("issue"), // "rfi", "issue", "clash", "change_request", "observation", "safety", "quality", "submittal", "material_request", "ncr", "inspection_request", "punch", "site_instruction"
  pinId: varchar("pin_id").references(() => pins.id, { onDelete: "set null" }), // Nullable - ticket can exist without pin
  drawingId: varchar("drawing_id").notNull().references(() => drawings.id),
  disciplineId: varchar("discipline_id").notNull().references(() => disciplines.id),
  layerId: varchar("layer_id").references(() => layers.id, { onDelete: "set null" }), // Optional layer reference
  priority: varchar("priority", { length: 20 }).notNull().default("medium"), // "low", "medium", "high", "blocker"
  status: varchar("status", { length: 50 }).notNull().default("open"), // "open", "in_review", "awaiting_info", "in_progress", "resolved", "closed"
  assignedTo: varchar("assigned_to").references(() => users.id),
  reporter: varchar("reporter").references(() => users.id), // Who reported/raised the ticket (can be different from createdBy)
  createdBy: varchar("created_by").notNull().references(() => users.id),
  slaHours: varchar("sla_hours", { length: 10 }), // SLA in hours (e.g., "24", "48", "72")
  dueDate: timestamp("due_date"), // Calculated due date based on SLA
  channelId: varchar("channel_id").references(() => channels.id, { onDelete: "set null" }), // Optional link to channel
  tags: text("tags").array(), // Tags for categorization
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tickets_status").on(table.status),
  index("idx_tickets_priority").on(table.priority),
  index("idx_tickets_assigned_to").on(table.assignedTo),
  index("idx_tickets_due_date").on(table.dueDate),
  index("idx_tickets_drawing_id").on(table.drawingId),
]);

// Layer relations
export const layersRelations = relations(layers, ({ one, many }) => ({
  drawing: one(drawings, {
    fields: [layers.drawingId],
    references: [drawings.id],
  }),
  discipline: one(disciplines, {
    fields: [layers.disciplineId],
    references: [disciplines.id],
  }),
  creator: one(users, {
    fields: [layers.createdBy],
    references: [users.id],
  }),
  pins: many(pins),
}));

// Pin relations
export const pinsRelations = relations(pins, ({ one, many }) => ({
  drawing: one(drawings, {
    fields: [pins.drawingId],
    references: [drawings.id],
  }),
  layer: one(layers, {
    fields: [pins.layerId],
    references: [layers.id],
  }),
  creator: one(users, {
    fields: [pins.createdBy],
    references: [users.id],
  }),
  tickets: many(tickets),
}));

// Ticket relations
export const ticketsRelations = relations(tickets, ({ one }) => ({
  pin: one(pins, {
    fields: [tickets.pinId],
    references: [pins.id],
  }),
  drawing: one(drawings, {
    fields: [tickets.drawingId],
    references: [drawings.id],
  }),
  discipline: one(disciplines, {
    fields: [tickets.disciplineId],
    references: [disciplines.id],
  }),
  layer: one(layers, {
    fields: [tickets.layerId],
    references: [layers.id],
  }),
  assignee: one(users, {
    fields: [tickets.assignedTo],
    references: [users.id],
    relationName: "ticketAssignee",
  }),
  reporter: one(users, {
    fields: [tickets.reporter],
    references: [users.id],
    relationName: "ticketReporter",
  }),
  creator: one(users, {
    fields: [tickets.createdBy],
    references: [users.id],
    relationName: "ticketCreator",
  }),
  channel: one(channels, {
    fields: [tickets.channelId],
    references: [channels.id],
  }),
}));

// Update drawings relations to include layers, pins, and tickets
export const drawingsRelationsUpdated = relations(drawings, ({ one, many }) => ({
  discipline: one(disciplines, {
    fields: [drawings.disciplineId],
    references: [disciplines.id],
  }),
  floor: one(floors, {
    fields: [drawings.floorId],
    references: [floors.id],
  }),
  creator: one(users, {
    fields: [drawings.createdBy],
    references: [users.id],
  }),
  revisions: many(drawingRevisions),
  layers: many(layers),
  pins: many(pins),
  tickets: many(tickets),
}));

// Zod schemas for validation
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  createdAt: true,
});
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channels.$inferSelect;

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

export const insertChannelMemberSchema = createInsertSchema(channelMembers).omit({
  id: true,
  joinedAt: true,
});
export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;
export type ChannelMember = typeof channelMembers.$inferSelect;

export const insertReactionSchema = createInsertSchema(reactions).omit({
  id: true,
  createdAt: true,
});
export type InsertReaction = z.infer<typeof insertReactionSchema>;
export type Reaction = typeof reactions.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const insertStarredMessageSchema = createInsertSchema(starredMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertStarredMessage = z.infer<typeof insertStarredMessageSchema>;
export type StarredMessage = typeof starredMessages.$inferSelect;

// Extended types for frontend use
export type ReactionWithUser = Reaction & {
  user: User;
};

export type MessageWithUser = Message & {
  user: User;
  threadReplies?: MessageWithUser[];
  reactions?: ReactionWithUser[];
};

export type ChannelWithMembers = Channel & {
  members: (ChannelMember & { user: User })[];
  creator: User;
};

export type DirectMessageWithUser = DirectMessage & {
  sender: User;
  recipient: User;
};

export type NotificationWithUsers = Notification & {
  fromUser: User;
  channel?: Channel;
};

// Drawings schemas
export const insertDisciplineSchema = createInsertSchema(disciplines).omit({
  id: true,
});
export type InsertDiscipline = z.infer<typeof insertDisciplineSchema>;
export type Discipline = typeof disciplines.$inferSelect;

export const insertFloorSchema = createInsertSchema(floors).omit({
  id: true,
});
export type InsertFloor = z.infer<typeof insertFloorSchema>;
export type Floor = typeof floors.$inferSelect;

export const insertDrawingSchema = createInsertSchema(drawings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDrawing = z.infer<typeof insertDrawingSchema>;
export type Drawing = typeof drawings.$inferSelect;

export const insertDrawingRevisionSchema = createInsertSchema(drawingRevisions).omit({
  id: true,
  uploadedAt: true,
  reviewedAt: true,
});
export type InsertDrawingRevision = z.infer<typeof insertDrawingRevisionSchema>;
export type DrawingRevision = typeof drawingRevisions.$inferSelect;

export const insertDrawingPageSchema = createInsertSchema(drawingPages).omit({
  id: true,
  createdAt: true,
});
export type InsertDrawingPage = z.infer<typeof insertDrawingPageSchema>;
export type DrawingPage = typeof drawingPages.$inferSelect;

// Extended types for frontend use
export type DrawingWithDetails = Drawing & {
  discipline: Discipline;
  floor?: Floor;
  creator: User;
  revisionCount?: number;
  latestRevision?: DrawingRevisionWithUser;
  revisions?: DrawingRevisionWithUser[];
};

export type DrawingRevisionWithUser = DrawingRevision & {
  uploader: User;
  reviewer?: User;
};

// Layers schemas
export const insertLayerSchema = createInsertSchema(layers).omit({
  id: true,
  createdAt: true,
});
export type InsertLayer = z.infer<typeof insertLayerSchema>;
export type Layer = typeof layers.$inferSelect;

// Pins schemas
export const insertPinSchema = createInsertSchema(pins).omit({
  id: true,
  createdAt: true,
}).extend({
  layerId: z.string().optional(), // Layer is optional - some drawings don't have layers
});
export type InsertPin = z.infer<typeof insertPinSchema>;
export type Pin = typeof pins.$inferSelect;

// Tickets schemas
export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  layerId: z.string().optional(),
  reporter: z.string().optional(),
  assignedTo: z.string().optional(),
  channelId: z.string().optional(),
  slaHours: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

// Saved Views schemas
export const insertSavedViewSchema = createInsertSchema(savedViews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSavedView = z.infer<typeof insertSavedViewSchema>;
export type SavedView = typeof savedViews.$inferSelect;

// Extended types for frontend use
export type LayerWithDetails = Layer & {
  discipline: Discipline;
  creator: User;
  pins?: PinWithDetails[];
};

export type PinWithDetails = Pin & {
  layer?: Layer;
  creator: User;
  tickets?: TicketWithDetails[];
};

export type TicketWithDetails = Ticket & {
  pin?: Pin;
  drawing: Drawing;
  discipline: Discipline;
  layer?: Layer;
  assignee?: User;
  reporter?: User;
  creator: User;
  channel?: { id: string; name: string };
};
