-- Drop legacy first_name/last_name columns from users table if they still exist
ALTER TABLE users DROP COLUMN IF EXISTS first_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
