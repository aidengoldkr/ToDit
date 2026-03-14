-- Supabase Schema for ToDit (Updated for NextAuth Google IDs)

-- 1. user_usage table
-- balance: current usage count (monthly)
CREATE TABLE IF NOT EXISTS public.user_usage (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  last_refill_at TIMESTAMPTZ DEFAULT NOW(),
  display_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  status TEXT NOT NULL DEFAULT 'inactive', -- 'active' for Pro, others for Free
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
  options JSONB, -- Pro generation options (model, detailLevel, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
