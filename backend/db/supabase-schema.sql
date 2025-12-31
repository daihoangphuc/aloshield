-- ALO Shield Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  
  -- Authentication
  password_hash TEXT,
  google_id VARCHAR(255) UNIQUE,
  supabase_id VARCHAR(255) UNIQUE,
  
  -- E2EE Keys (public only)
  identity_public_key TEXT,
  signed_pre_key TEXT,
  signed_pre_key_signature TEXT,
  
  -- Status
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);

-- =====================
-- ONE TIME PRE KEYS
-- =====================
CREATE TABLE IF NOT EXISTS one_time_pre_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_otpk_user_unused ON one_time_pre_keys(user_id, used) WHERE used = FALSE;

-- =====================
-- CONTACTS
-- =====================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);

-- =====================
-- CONVERSATIONS
-- =====================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(20) NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name VARCHAR(255),
  avatar_url TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- CONVERSATION PARTICIPANTS
-- =====================
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  can_send_messages BOOLEAN DEFAULT TRUE,
  
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);

-- =====================
-- MESSAGES
-- =====================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  encrypted_content TEXT NOT NULL,
  content_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'video', 'file', 'audio', 'location')),
  
  session_version INTEGER NOT NULL DEFAULT 1,
  ratchet_step INTEGER NOT NULL DEFAULT 0,
  
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  reply_to_message_id UUID REFERENCES messages(id),
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_message_id);

-- =====================
-- MESSAGE RECEIPTS
-- =====================
CREATE TABLE IF NOT EXISTS message_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_message ON message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON message_receipts(user_id);

-- =====================
-- MESSAGE REACTIONS
-- =====================
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON message_reactions(user_id);

-- =====================
-- ATTACHMENTS
-- =====================
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  
  r2_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  encrypted_file_key TEXT,
  
  thumbnail_r2_key TEXT,
  thumbnail_file_key TEXT,
  
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);

-- =====================
-- CALLS
-- =====================
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  caller_id UUID NOT NULL REFERENCES users(id),
  
  type VARCHAR(20) NOT NULL CHECK (type IN ('audio', 'video')),
  status VARCHAR(20) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'rejected', 'missed', 'ended', 'failed')),
  
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  
  participants JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_calls_conversation ON calls(conversation_id, initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id);

-- =====================
-- BLOCKED USERS
-- =====================
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  reason TEXT,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON blocked_users(blocked_id);

-- =====================
-- FUNCTIONS
-- =====================

-- Update conversation updated_at on new message
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON messages;
CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();

-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_conversations_updated_at ON conversations;
CREATE TRIGGER trigger_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to get direct conversation between two users
CREATE OR REPLACE FUNCTION get_direct_conversation(user_id_1 UUID, user_id_2 UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
BEGIN
  SELECT cp1.conversation_id INTO conv_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = user_id_1
    AND cp2.user_id = user_id_2
    AND c.type = 'direct'
  LIMIT 1;
  
  RETURN conv_id;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- ROW LEVEL SECURITY (Optional - Enable if needed)
-- =====================
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Thêm cột password_hash vào bảng users (nếu bảng đã tồn tại)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;