-- Thêm cột supabase_id vào bảng users
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_id VARCHAR(255) UNIQUE;

-- Tạo index cho cột mới
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);

