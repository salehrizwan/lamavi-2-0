-- LAMAVI Messenger - Supabase Database Schema
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor) to provision the database.

-- 1. Users table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL,
  is_online BOOLEAN NOT NULL DEFAULT false,
  recovery_code TEXT,
  privacy JSONB NOT NULL DEFAULT '{"profilePhoto":"everyone","lastSeen":"everyone","readReceipts":true,"statusPrivacy":"everyone"}'::jsonb,
  blocked_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

-- Index for instant username and email lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (lower(username));
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (lower(email));

-- 2. Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  participant_ids JSONB NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  cleared_timestamps JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_for_users JSONB NOT NULL DEFAULT '[]'::jsonb,
  unread_counts JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations (updated_at DESC);

-- 3. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  client_temp_id TEXT,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  caption TEXT,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at BIGINT NOT NULL,
  deleted_for JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_deleted_for_everyone BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages (receiver_id);

-- 4. Statuses table (Stories with 24-hour expiration)
CREATE TABLE IF NOT EXISTS public.statuses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  background_color TEXT,
  font_style TEXT,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  viewers JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_statuses_expires_at ON public.statuses (expires_at DESC);

-- 5. Reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Enable Row Level Security (RLS) but allow service role access
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Service role has full access to all tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_users_all' AND tablename = 'users') THEN
    CREATE POLICY service_role_users_all ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_users_read_write' AND tablename = 'users') THEN
    CREATE POLICY anon_users_read_write ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_conversations_all' AND tablename = 'conversations') THEN
    CREATE POLICY service_role_conversations_all ON public.conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_conversations_read_write' AND tablename = 'conversations') THEN
    CREATE POLICY anon_conversations_read_write ON public.conversations FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_messages_all' AND tablename = 'messages') THEN
    CREATE POLICY service_role_messages_all ON public.messages FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_messages_read_write' AND tablename = 'messages') THEN
    CREATE POLICY anon_messages_read_write ON public.messages FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_statuses_all' AND tablename = 'statuses') THEN
    CREATE POLICY service_role_statuses_all ON public.statuses FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_statuses_read_write' AND tablename = 'statuses') THEN
    CREATE POLICY anon_statuses_read_write ON public.statuses FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_reports_all' AND tablename = 'reports') THEN
    CREATE POLICY service_role_reports_all ON public.reports FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_reports_read_write' AND tablename = 'reports') THEN
    CREATE POLICY anon_reports_read_write ON public.reports FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
