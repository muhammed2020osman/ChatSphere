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

// Companies table - Multi-Tenant SaaS
export const companies = mysqlTable("companies", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  invitationCode: varchar("invitation_code", { length: 50 }),
  planType: varchar("plan_type", { length: 50 }).default("basic").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => [
  index("idx_companies_domain").on(table.domain),
  index("idx_companies_invitation_code").on(table.invitationCode),
]);

// User storage table - Required for Replit Auth
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  profileImageUrl: text("profile_image_url"),
  status: varchar("status", { length: 50 }),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen"),
  role: varchar("role", { length: 20 }).default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("idx_users_email_company").on(table.email, table.companyId),
  index("idx_users_company").on(table.companyId),
]);

// Channels table
export const channels = mysqlTable("channels", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isPrivate: boolean("is_private").default(false).notNull(),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_channels_company").on(table.companyId),
]);

// Messages table
export const messages = mysqlTable("messages", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
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
}, (table) => [
  index("idx_messages_company").on(table.companyId),
]);

// Drawings table
export const drawings = mysqlTable("drawings", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  data: json("data").notNull(),
  disciplineId: int("discipline_id").references(() => disciplines.id),
  floorId: int("floor_id").references(() => floors.id),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => [
  index("idx_drawings_company").on(table.companyId),
]);

// Tickets table
export const tickets = mysqlTable("tickets", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
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
}, (table) => [
  index("idx_tickets_company").on(table.companyId),
]);

// Direct messages table
export const directMessages = mysqlTable("direct_messages", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
  content: text("content").notNull(),
  fromUserId: int("from_user_id").notNull().references(() => users.id),
  toUserId: int("to_user_id").notNull().references(() => users.id),
  replyToId: int("reply_to_id"),
  attachmentUrl: text("attachment_url"),
  attachmentType: varchar("attachment_type", { length: 100 }),
  attachmentName: varchar("attachment_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => [
  index("idx_direct_messages_company").on(table.companyId),
]);

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
  companyId: int("company_id").notNull().references(() => companies.id),
  messageId: int("message_id").notNull().references(() => messages.id),
  userId: int("user_id").notNull().references(() => users.id),
  icon: varchar("icon", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reactions_company").on(table.companyId),
]);

// Notifications table
export const notifications = mysqlTable("notifications", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
  userId: int("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  messageId: int("message_id").references(() => messages.id),
  channelId: int("channel_id").references(() => channels.id),
  fromUserId: int("from_user_id").references(() => users.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notifications_company").on(table.companyId),
]);

// Starred messages table
export const starredMessages = mysqlTable("starred_messages", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
  messageId: int("message_id").notNull().references(() => messages.id),
  userId: int("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_starred_messages_company").on(table.companyId),
  uniqueIndex("unique_message_user").on(table.messageId, table.userId),
]);

// Attachments table
export const attachments = mysqlTable("attachments", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: varchar("size", { length: 20 }).notNull(),
  url: text("url").notNull(),
  messageId: int("message_id").references(() => messages.id),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_attachments_company").on(table.companyId),
]);

// Disciplines table
export const disciplines = mysqlTable("disciplines", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  code: varchar("code", { length: 20 }),
  color: varchar("color", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_disciplines_company").on(table.companyId),
]);

// Projects table
export const projects = mysqlTable("projects", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("active"),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => [
  index("idx_projects_company").on(table.companyId),
]);

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
  companyId: int("company_id").notNull().references(() => companies.id),
  name: varchar("name", { length: 100 }).notNull(),
  level: varchar("level", { length: 20 }).notNull(),
  description: text("description"),
  projectId: int("project_id").references(() => projects.id),
  sortOrder: varchar("sort_order", { length: 10 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_floors_company").on(table.companyId),
]);

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
  companyId: int("company_id").notNull().references(() => companies.id),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data").notNull(),
  userId: int("user_id").notNull().references(() => users.id),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => [
  index("idx_saved_views_company").on(table.companyId),
]);


// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  channels: many(channels),
  messages: many(messages),
  drawings: many(drawings),
  tickets: many(tickets),
  projects: many(projects),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  channels: many(channels),
  messages: many(messages),
  drawings: many(drawings),
  tickets: many(tickets),
  attachments: many(attachments),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  company: one(companies, {
    fields: [channels.companyId],
    references: [companies.id],
  }),
  createdBy: one(users, {
    fields: [channels.createdBy],
    references: [users.id],
  }),
  members: many(channelMembers),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  company: one(companies, {
    fields: [messages.companyId],
    references: [companies.id],
  }),
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

// Helper function to convert string IDs to numbers
function convertStringIdToNumber(value: any): number | null | undefined {
  if (value == null || value === undefined || value === '') {
    return value === null ? null : undefined;
  }
  if (typeof value === 'number') {
    if (isNaN(value)) {
      return null;
    }
    return value;
  }
  if (typeof value === 'string') {
    // Handle "auth:1" format
    const match = value.match(/^auth:(\d+)$/) || value.match(/^(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (isNaN(num)) {
        return null;
      }
      return num;
    }
    // Try direct parse
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      return null;
    }
    return parsed;
  }
  return null;
}

// Helper to create preprocessed field schema
function preprocessNumberField(required: boolean = false) {
  if (required) {
    return z.preprocess(
      (val) => {
        if (val == null) throw new Error('Field is required');
        const converted = convertStringIdToNumber(val);
        if (converted == null) throw new Error(`Invalid number: ${val}`);
        return converted;
      },
      z.number()
    );
  }
  return z.preprocess(
    (val) => convertStringIdToNumber(val),
    z.number().nullable().optional()
  );
}

// Zod schemas
// Remove 'id' from all insert schemas since all tables use AUTO_INCREMENT
// Convert all foreign key fields from string to number using preprocess
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
  });

export const insertChannelSchema = createInsertSchema(channels)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    createdBy: z.preprocess(
      (val) => {
        if (val == null) return val;
        return convertStringIdToNumber(val);
      },
      z.number()
    ),
  });

export const insertMessageSchema = createInsertSchema(messages)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    userId: z.preprocess(
      (val) => {
        if (val == null) throw new Error('userId is required');
        const converted = convertStringIdToNumber(val);
        if (converted == null) throw new Error(`Invalid userId: ${val}`);
        return converted;
      },
      z.number()
    ),
    channelId: z.preprocess(
      (val) => convertStringIdToNumber(val),
      z.number().nullable().optional()
    ),
    replyToId: z.preprocess(
      (val) => convertStringIdToNumber(val),
      z.number().nullable().optional()
    ),
    threadParentId: z.preprocess(
      (val) => convertStringIdToNumber(val),
      z.number().nullable().optional()
    ),
  });

export const insertDirectMessageSchema = createInsertSchema(directMessages)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    fromUserId: z.preprocess(
      (val) => {
        if (val == null) throw new Error('fromUserId is required');
        const converted = convertStringIdToNumber(val);
        if (converted == null) throw new Error(`Invalid fromUserId: ${val}`);
        return converted;
      },
      z.number()
    ),
    toUserId: z.preprocess(
      (val) => {
        if (val == null) throw new Error('toUserId is required');
        const converted = convertStringIdToNumber(val);
        if (converted == null) throw new Error(`Invalid toUserId: ${val}`);
        return converted;
      },
      z.number()
    ),
    replyToId: z.preprocess(
      (val) => convertStringIdToNumber(val),
      z.number().nullable().optional()
    ),
  });

export const insertDrawingSchema = createInsertSchema(drawings)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    createdBy: preprocessNumberField(true),
    disciplineId: preprocessNumberField(false),
    floorId: preprocessNumberField(false),
  });

export const insertTicketSchema = createInsertSchema(tickets)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    createdBy: preprocessNumberField(true),
    assignedTo: preprocessNumberField(false),
    reporter: preprocessNumberField(false),
    channelId: preprocessNumberField(false),
    drawingId: preprocessNumberField(false),
    disciplineId: preprocessNumberField(false),
    pinId: preprocessNumberField(false),
    layerId: preprocessNumberField(false),
  });
export const insertAttachmentSchema = createInsertSchema(attachments)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    messageId: preprocessNumberField(false),
    createdBy: preprocessNumberField(true),
  });

export const insertDrawingPageSchema = createInsertSchema(drawingPages)
  .omit({ id: true })
  .extend({
    revisionId: preprocessNumberField(true),
  });

export const insertDrawingRevisionSchema = createInsertSchema(drawingRevisions)
  .omit({ id: true })
  .extend({
    drawingId: preprocessNumberField(true),
    createdBy: preprocessNumberField(true),
    uploadedBy: preprocessNumberField(false),
    reviewedBy: preprocessNumberField(false),
  });

export const insertDrawingAnnotationSchema = createInsertSchema(drawingAnnotations)
  .omit({ id: true })
  .extend({
    drawingId: preprocessNumberField(true),
    pageId: preprocessNumberField(false),
    createdBy: preprocessNumberField(true),
  });

export const insertDrawingCommentSchema = createInsertSchema(drawingComments)
  .omit({ id: true })
  .extend({
    drawingId: preprocessNumberField(true),
    createdBy: preprocessNumberField(true),
  });

export const insertDisciplineSchema = createInsertSchema(disciplines)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
  });

export const insertProjectSchema = createInsertSchema(projects)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    createdBy: preprocessNumberField(true),
  });

export const insertFloorSchema = createInsertSchema(floors)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    projectId: preprocessNumberField(false),
  });

export const insertRoomSchema = createInsertSchema(rooms)
  .omit({ id: true })
  .extend({
    floorId: preprocessNumberField(false),
  });

export const insertLayerSchema = createInsertSchema(layers)
  .omit({ id: true })
  .extend({
    drawingId: preprocessNumberField(false),
    createdBy: preprocessNumberField(true),
  });

export const insertPinSchema = createInsertSchema(pins)
  .omit({ id: true })
  .extend({
    drawingId: preprocessNumberField(false),
    layerId: preprocessNumberField(false),
    createdBy: preprocessNumberField(true),
  });

export const insertSavedViewSchema = createInsertSchema(savedViews)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    userId: preprocessNumberField(true),
  });

export const insertReactionSchema = createInsertSchema(reactions)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    messageId: preprocessNumberField(false),
    userId: preprocessNumberField(true),
  });

export const insertNotificationSchema = createInsertSchema(notifications)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    userId: preprocessNumberField(true),
    messageId: preprocessNumberField(false),
    channelId: preprocessNumberField(false),
    fromUserId: preprocessNumberField(false),
  });

export const insertStarredMessageSchema = createInsertSchema(starredMessages)
  .omit({ id: true })
  .extend({
    companyId: preprocessNumberField(true),
    messageId: preprocessNumberField(false),
    userId: preprocessNumberField(true),
  });

export const insertChannelMemberSchema = createInsertSchema(channelMembers)
  .omit({ id: true })
  .extend({
    channelId: preprocessNumberField(true),
    userId: preprocessNumberField(true),
  });

export const insertProjectMemberSchema = createInsertSchema(projectMembers)
  .omit({ id: true })
  .extend({
    projectId: preprocessNumberField(true),
    userId: preprocessNumberField(true),
  });

export const insertDrawingLayerSchema = createInsertSchema(drawingLayers)
  .omit({ id: true })
  .extend({
    drawingId: preprocessNumberField(true),
    layerId: preprocessNumberField(true),
  });

export const insertDrawingPinSchema = createInsertSchema(drawingPins)
  .omit({ id: true })
  .extend({
    drawingId: preprocessNumberField(true),
    pinId: preprocessNumberField(true),
  });

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
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
