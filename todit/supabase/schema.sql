-- Supabase Schema for ToDit

-- 1. users table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,

  -- Auth fields
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT,
  image TEXT,
  provider TEXT NOT NULL DEFAULT 'credentials',
  email_verified_at TIMESTAMPTZ DEFAULT NULL,
  verification_token TEXT,
  verification_expires_at TIMESTAMPTZ DEFAULT NULL,
  verification_last_sent_at TIMESTAMPTZ DEFAULT NULL,

  -- Usage fields
  balance INTEGER NOT NULL DEFAULT 0,
  last_refill_at TIMESTAMPTZ DEFAULT NOW(),

  -- Common fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON public.users(verification_token);

-- 2. user_consents table
CREATE TABLE IF NOT EXISTS public.user_consents (
  user_id TEXT PRIMARY KEY,
  terms_agreed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. saved_todo table
CREATE TABLE IF NOT EXISTS public.saved_todo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  plan JSONB NOT NULL,
  title TEXT,
  category TEXT,
  document_type TEXT,
  plan_version INTEGER NOT NULL DEFAULT 1,
  options JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
