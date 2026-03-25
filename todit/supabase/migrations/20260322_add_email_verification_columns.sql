-- users 테이블에 이메일 인증 관련 컬럼 추가
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verification_token TEXT,
  ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ DEFAULT NULL;

-- 토큰 검색 성능을 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON public.users(verification_token);
