-- Migration script to make only name, email, and password_hash required
-- All other fields should have defaults or be nullable

-- Ensure role has a default value
ALTER TABLE users MODIFY COLUMN role VARCHAR(20) DEFAULT 'member' NOT NULL;

-- Ensure id has default (UUID generation)
-- Note: MySQL doesn't support UUID() as default directly, but if using MariaDB or MySQL 8.0.13+
-- This might need to be handled at application level
-- ALTER TABLE users MODIFY COLUMN id VARCHAR(191) DEFAULT (UUID());

-- Ensure is_online has default
ALTER TABLE users MODIFY COLUMN is_online BOOLEAN DEFAULT FALSE;

-- Ensure created_at has default
ALTER TABLE users MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Ensure updated_at has default
ALTER TABLE users MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Ensure profile_image_url is nullable (should already be)
ALTER TABLE users MODIFY COLUMN profile_image_url TEXT NULL;

-- Ensure status is nullable (should already be)
ALTER TABLE users MODIFY COLUMN status VARCHAR(50) NULL;

-- Ensure last_seen is nullable (should already be)
ALTER TABLE users MODIFY COLUMN last_seen TIMESTAMP NULL;

