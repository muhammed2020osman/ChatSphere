-- Initialize ChatSphere database
CREATE DATABASE IF NOT EXISTS chatsphere_local;
USE chatsphere_local;

-- Create disciplines table
CREATE TABLE IF NOT EXISTS disciplines (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  code VARCHAR(50),
  color VARCHAR(7),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create floors table
CREATE TABLE IF NOT EXISTS floors (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  level VARCHAR(50),
  description TEXT,
  projectId VARCHAR(191),
  sortOrder INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(191) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  profileImageUrl TEXT,
  role VARCHAR(50) DEFAULT 'user',
  isOnline BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create channels table
CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(191) PRIMARY KEY,
  content TEXT NOT NULL,
  userId VARCHAR(191) NOT NULL,
  channelId VARCHAR(191) NOT NULL,
  replyToId VARCHAR(191),
  threadParentId VARCHAR(191),
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

-- Insert initial data
INSERT INTO disciplines (id, name, description, code, color, createdAt) VALUES
('disc-1', 'Architecture', 'Architectural drawings', 'ARCH', '#3B82F6', NOW()),
('disc-2', 'Structural', 'Structural engineering', 'STR', '#10B981', NOW()),
('disc-3', 'MEP', 'Mechanical, Electrical, Plumbing', 'MEP', '#F59E0B', NOW()),
('disc-4', 'Civil', 'Civil engineering', 'CIV', '#8B5CF6', NOW()),
('disc-5', 'Landscape', 'Landscape architecture', 'LAND', '#06B6D4', NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO floors (id, name, level, description, projectId, sortOrder, createdAt) VALUES
('floor-1', 'Ground Floor', '0', 'Ground level', NULL, 1, NOW()),
('floor-2', 'First Floor', '1', 'First level', NULL, 2, NOW()),
('floor-3', 'Second Floor', '2', 'Second level', NULL, 3, NOW()),
('floor-4', 'Third Floor', '3', 'Third level', NULL, 4, NOW()),
('floor-5', 'Basement', '-1', 'Basement level', NULL, 0, NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);
