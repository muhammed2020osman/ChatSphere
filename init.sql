-- Initialize ChatSphere database
CREATE DATABASE IF NOT EXISTS chatsphere_local;
USE chatsphere_local;

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

-- Insert initial data
INSERT INTO disciplines (name, description, code, color, createdAt) VALUES
('Architecture', 'Architectural drawings', 'ARCH', '#3B82F6', NOW()),
('Structural', 'Structural engineering', 'STR', '#10B981', NOW()),
('MEP', 'Mechanical, Electrical, Plumbing', 'MEP', '#F59E0B', NOW()),
('Civil', 'Civil engineering', 'CIV', '#8B5CF6', NOW()),
('Landscape', 'Landscape architecture', 'LAND', '#06B6D4', NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO floors (name, level, description, projectId, sortOrder, createdAt) VALUES
('Ground Floor', '0', 'Ground level', NULL, 1, NOW()),
('First Floor', '1', 'First level', NULL, 2, NOW()),
('Second Floor', '2', 'Second level', NULL, 3, NOW()),
('Third Floor', '3', 'Third level', NULL, 4, NOW()),
('Basement', '-1', 'Basement level', NULL, 0, NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);
