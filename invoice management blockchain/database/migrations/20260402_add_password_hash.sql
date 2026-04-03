-- Add password_hash column to users table for bcrypt-based auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
