-- Safe merge migration for usage data.
-- This migration is intentionally additive. It never drops public.users.

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT,
  image TEXT,
  provider TEXT NOT NULL DEFAULT 'credentials',
  balance INTEGER NOT NULL DEFAULT 0,
  last_refill_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_refill_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_usage'
  ) THEN
    INSERT INTO public.users (
      id,
      name,
      balance,
      last_refill_at,
      provider,
      created_at,
      updated_at
    )
    SELECT
      user_id,
      display_name,
      COALESCE(balance, 0),
      COALESCE(last_refill_at, NOW()),
      'google',
      NOW(),
      NOW()
    FROM public.user_usage
    ON CONFLICT (id) DO UPDATE
    SET
      name = COALESCE(public.users.name, EXCLUDED.name),
      balance = EXCLUDED.balance,
      last_refill_at = EXCLUDED.last_refill_at,
      updated_at = NOW();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
