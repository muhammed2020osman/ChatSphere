-- Fix notifications table to add missing direct_message_id column
-- Run this SQL script to update the table structure

-- Check if column exists, if not add it
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS direct_message_id INT NULL AFTER channel_id;

-- Add foreign key if it doesn't exist
-- Note: MySQL doesn't support IF NOT EXISTS for foreign keys, so check manually first
-- ALTER TABLE notifications 
-- ADD CONSTRAINT fk_notifications_direct_message 
-- FOREIGN KEY (direct_message_id) REFERENCES direct_messages(id);

-- Verify the table structure
DESCRIBE notifications;

