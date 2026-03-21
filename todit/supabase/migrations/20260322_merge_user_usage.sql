-- 1. 혹시 미리 생성한 users 테이블이 있다면 삭제합니다.
DROP TABLE IF EXISTS public.users;

-- 2. 기존 user_usage 테이블의 이름을 users로 변경합니다.
ALTER TABLE public.user_usage RENAME TO users;

-- 3. 기존 컬럼명의 이름을 통합에 맞게 수정합니다.
ALTER TABLE public.users RENAME COLUMN user_id TO id;
ALTER TABLE public.users RENAME COLUMN display_name TO name;

-- [수정된 부분] id 컬럼이 자동으로 채워지도록 기본값(UUID) 속성을 추가합니다.
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

-- 4. 자체 로그인 및 인증 관련 신규 컬럼들을 추가합니다.
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'google';

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
