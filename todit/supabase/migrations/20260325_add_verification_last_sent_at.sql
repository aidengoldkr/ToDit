-- Add verification_last_sent_at for email resend cooldown tracking
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verification_last_sent_at TIMESTAMPTZ DEFAULT NULL;
