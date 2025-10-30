-- Enforce required fields on users table
-- Ensure columns exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;

-- Make fields required
ALTER TABLE users MODIFY COLUMN name VARCHAR(255) NOT NULL;
ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL;
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL;

-- Add unique index on email (ignore error if it already exists)
CREATE UNIQUE INDEX idx_users_email ON users(email);
