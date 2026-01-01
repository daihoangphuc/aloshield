-- Thêm cột supabase_id vào bảng users
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_id VARCHAR(255) UNIQUE;

-- Tạo index cho cột mới
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);

-- Add deleted_at column for soft delete support
ALTER TABLE conversation_participants 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_conversation_participants_deleted_at 
ON conversation_participants(deleted_at) 
WHERE deleted_at IS NULL;