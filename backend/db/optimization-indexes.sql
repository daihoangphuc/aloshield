-- =====================
-- PERFORMANCE OPTIMIZATION INDEXES
-- Run this in Supabase SQL Editor
-- =====================

-- Composite index for participant lookups (used in getConversations)
-- This speeds up queries that filter by user_id and join with conversations
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_conv 
ON conversation_participants(user_id, conversation_id);

-- Composite index for unread count queries
-- Optimizes: messages WHERE conversation_id = X AND sender_id != Y AND created_at > Z
CREATE INDEX IF NOT EXISTS idx_messages_conv_sender_created 
ON messages(conversation_id, sender_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for conversation list queries sorted by updated_at
-- Speeds up: conversation_participants WHERE user_id = X ORDER BY conversations.updated_at DESC
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_updated 
ON conversation_participants(user_id, last_read_at DESC);

-- Composite index for message receipts lookups
CREATE INDEX IF NOT EXISTS idx_receipts_message_user 
ON message_receipts(message_id, user_id);

-- Index for message search by conversation and date range
CREATE INDEX IF NOT EXISTS idx_messages_conv_created_deleted 
ON messages(conversation_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for user presence queries
CREATE INDEX IF NOT EXISTS idx_users_online_last_seen 
ON users(is_online, last_seen_at DESC);

-- Index for contacts lookups
CREATE INDEX IF NOT EXISTS idx_contacts_user_contact 
ON contacts(user_id, contact_id);

-- Partial index for active conversations only
CREATE INDEX IF NOT EXISTS idx_conv_participants_active 
ON conversation_participants(user_id, conversation_id) 
WHERE left_at IS NULL;

-- Analyze tables to update statistics
ANALYZE conversation_participants;
ANALYZE messages;
ANALYZE message_receipts;
ANALYZE users;
ANALYZE contacts;

