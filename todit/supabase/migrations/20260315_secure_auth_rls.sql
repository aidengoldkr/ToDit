-- 1. HTTP 헤더에서 사용자 ID를 가져오는 함수 (NextAuth 연동용)
-- 보안상 public 스키마에 생성합니다. (auth 스키마는 권한 제한이 있을 수 있음)
CREATE OR REPLACE FUNCTION public.get_app_user_id() 
RETURNS text AS $$
BEGIN
  -- HTTP 헤더 'x-todit-user-id' 값을 읽어옵니다.
  RETURN current_setting('request.headers', true)::json->>'x-todit-user-id';
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- 3. saved_todo 정책 업데이트
ALTER TABLE public.saved_todo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "사용자 본인 데이터만 조회" ON public.saved_todo;
CREATE POLICY "사용자 본인 데이터만 조회" ON public.saved_todo
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS "사용자 본인 데이터만 생성" ON public.saved_todo;
CREATE POLICY "사용자 본인 데이터만 생성" ON public.saved_todo
  FOR INSERT WITH CHECK (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS "사용자 본인 데이터만 수정" ON public.saved_todo;
CREATE POLICY "사용자 본인 데이터만 수정" ON public.saved_todo
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS "사용자 본인 데이터만 삭제" ON public.saved_todo;
CREATE POLICY "사용자 본인 데이터만 삭제" ON public.saved_todo
  FOR DELETE USING (user_id = public.get_app_user_id());

-- 4. user_usage 정책 업데이트 (조회는 본인만)
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "사용자 본인 사용량만 조회" ON public.user_usage;
CREATE POLICY "사용자 본인 사용량만 조회" ON public.user_usage
  FOR SELECT USING (user_id = public.get_app_user_id());

-- 5. user_consents 정책 업데이트
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "사용자 본인 동의만 조회" ON public.user_consents;
CREATE POLICY "사용자 본인 동의만 조회" ON public.user_consents
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS "사용자 본인 동의만 생성/수정" ON public.user_consents;
CREATE POLICY "사용자 본인 동의만 생성/수정" ON public.user_consents
  FOR INSERT WITH CHECK (user_id = public.get_app_user_id());
