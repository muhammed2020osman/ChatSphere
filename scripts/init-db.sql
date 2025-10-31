-- Database initialization script for ChatSphere
-- This script creates all necessary tables and initial data

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS `software-link_chatsphere`;
USE `software-link_chatsphere`;

-- Create disciplines table
CREATE TABLE IF NOT EXISTS disciplines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  code VARCHAR(50),
  color VARCHAR(7),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create floors table
CREATE TABLE IF NOT EXISTS floors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  level VARCHAR(50),
  description TEXT,
  projectId INT,
  sortOrder INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  profileImageUrl TEXT,
  role VARCHAR(50) DEFAULT 'user',
  isOnline BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_users_email (email)
);

-- Create channels table
CREATE TABLE IF NOT EXISTS channels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content TEXT NOT NULL,
  userId INT NOT NULL,
  channelId INT NOT NULL,
  replyToId INT,
  threadParentId INT,
  attachmentUrl TEXT,
  attachmentType VARCHAR(100),
  attachmentName VARCHAR(255),
  mentions TEXT,
  editedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (channelId) REFERENCES channels(id)
);

-- Create direct_messages table
CREATE TABLE IF NOT EXISTS direct_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content TEXT NOT NULL,
  fromUserId INT NOT NULL,
  toUserId INT NOT NULL,
  replyToId INT,
  attachmentUrl TEXT,
  attachmentType VARCHAR(100),
  attachmentName VARCHAR(255),
  editedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (fromUserId) REFERENCES users(id),
  FOREIGN KEY (toUserId) REFERENCES users(id)
);

-- Create reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  messageId INT NOT NULL,
  userId INT NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  icon VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (messageId) REFERENCES messages(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  messageId INT,
  channelId INT,
  fromUserId INT,
  content TEXT,
  type VARCHAR(50) NOT NULL,
  isRead BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (messageId) REFERENCES messages(id),
  FOREIGN KEY (channelId) REFERENCES channels(id),
  FOREIGN KEY (fromUserId) REFERENCES users(id)
);

-- Create starred_messages table
CREATE TABLE IF NOT EXISTS starred_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  messageId INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (messageId) REFERENCES messages(id)
);

-- Create drawings table
CREATE TABLE IF NOT EXISTS drawings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  disciplineId INT,
  floorId INT,
  projectId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (disciplineId) REFERENCES disciplines(id),
  FOREIGN KEY (floorId) REFERENCES floors(id)
);

-- Create drawing_revisions table
CREATE TABLE IF NOT EXISTS drawing_revisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  drawingId INT NOT NULL,
  version VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  fileUrl TEXT,
  thumbnailUrl TEXT,
  fileName VARCHAR(255),
  fileType VARCHAR(100),
  fileSize BIGINT,
  aiExtractedData JSON,
  uploadedBy INT,
  reviewedBy INT,
  reviewNotes TEXT,
  uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (drawingId) REFERENCES drawings(id),
  FOREIGN KEY (uploadedBy) REFERENCES users(id),
  FOREIGN KEY (reviewedBy) REFERENCES users(id)
);

-- Create drawing_pages table
CREATE TABLE IF NOT EXISTS drawing_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  revisionId INT NOT NULL,
  pageNumber INT NOT NULL,
  imageUrl TEXT,
  thumbnailUrl TEXT,
  extractedText TEXT,
  extractedMetadata JSON,
  aiExtractedData JSON,
  width INT,
  height INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (revisionId) REFERENCES drawing_revisions(id)
);

-- Create layers table
CREATE TABLE IF NOT EXISTS layers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  drawingId INT NOT NULL,
  visible BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (drawingId) REFERENCES drawings(id)
);

-- Create pins table
CREATE TABLE IF NOT EXISTS pins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  x DECIMAL(10,2) NOT NULL,
  y DECIMAL(10,2) NOT NULL,
  drawingId INT NOT NULL,
  layerId INT,
  title VARCHAR(255),
  description TEXT,
  type VARCHAR(50) DEFAULT 'general',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (drawingId) REFERENCES drawings(id),
  FOREIGN KEY (layerId) REFERENCES layers(id)
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'general',
  status VARCHAR(50) DEFAULT 'open',
  priority VARCHAR(50) DEFAULT 'medium',
  drawingId INT,
  disciplineId INT,
  pinId INT,
  layerId INT,
  reporter INT NOT NULL,
  assignee INT,
  channelId INT,
  slaHours INT DEFAULT 24,
  dueDate TIMESTAMP NULL,
  tags TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (drawingId) REFERENCES drawings(id),
  FOREIGN KEY (disciplineId) REFERENCES disciplines(id),
  FOREIGN KEY (pinId) REFERENCES pins(id),
  FOREIGN KEY (layerId) REFERENCES layers(id),
  FOREIGN KEY (reporter) REFERENCES users(id),
  FOREIGN KEY (assignee) REFERENCES users(id),
  FOREIGN KEY (channelId) REFERENCES channels(id)
);

-- Create saved_views table
CREATE TABLE IF NOT EXISTS saved_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  userId INT NOT NULL,
  drawingId INT NOT NULL,
  viewData JSON NOT NULL,
  isShared BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (drawingId) REFERENCES drawings(id)
);

-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fileName VARCHAR(255) NOT NULL,
  fileType VARCHAR(100) NOT NULL,
  fileSize BIGINT NOT NULL,
  fileUrl TEXT NOT NULL,
  uploadedBy VARCHAR(191) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploadedBy) REFERENCES users(id)
);

-- Create channel_members table
CREATE TABLE IF NOT EXISTS channel_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  channelId INT NOT NULL,
  userId INT NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channelId) REFERENCES channels(id),
  FOREIGN KEY (userId) REFERENCES users(id),
  UNIQUE KEY unique_channel_user (channelId, userId)
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Insert initial disciplines data
INSERT IGNORE INTO disciplines (id, name, description, code, color, createdAt) VALUES
('disc-1', 'Architecture', 'Architectural drawings', 'ARCH', '#3B82F6', NOW()),
('disc-2', 'Structural', 'Structural engineering', 'STR', '#10B981', NOW()),
('disc-3', 'MEP', 'Mechanical, Electrical, Plumbing', 'MEP', '#F59E0B', NOW()),
('disc-4', 'Civil', 'Civil engineering', 'CIV', '#8B5CF6', NOW()),
('disc-5', 'Landscape', 'Landscape architecture', 'LAND', '#06B6D4', NOW());

-- Insert initial floors data
INSERT IGNORE INTO floors (id, name, level, description, projectId, sortOrder, createdAt) VALUES
('floor-1', 'Ground Floor', '0', 'Ground level', NULL, 1, NOW()),
('floor-2', 'First Floor', '1', 'First level', NULL, 2, NOW()),
('floor-3', 'Second Floor', '2', 'Second level', NULL, 3, NOW()),
('floor-4', 'Third Floor', '3', 'Third level', NULL, 4, NOW()),
('floor-5', 'Basement', '-1', 'Basement level', NULL, 0, NOW()),
('floor-6', 'Roof', 'R', 'Roof level', NULL, 5, NOW());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channelId);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(userId);
CREATE INDEX IF NOT EXISTS idx_direct_messages_from_user ON direct_messages(fromUserId);
CREATE INDEX IF NOT EXISTS idx_direct_messages_to_user ON direct_messages(toUserId);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(userId);
CREATE INDEX IF NOT EXISTS idx_drawing_revisions_drawing_id ON drawing_revisions(drawingId);
CREATE INDEX IF NOT EXISTS idx_drawing_pages_revision_id ON drawing_pages(revisionId);
CREATE INDEX IF NOT EXISTS idx_pins_drawing_id ON pins(drawingId);
CREATE INDEX IF NOT EXISTS idx_tickets_drawing_id ON tickets(drawingId);
CREATE INDEX IF NOT EXISTS idx_tickets_reporter ON tickets(reporter);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee);
