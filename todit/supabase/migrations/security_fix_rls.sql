-- ============================================================
-- ToDit 보안 패치: Row Level Security (RLS) 활성화
-- 실행 대상: Supabase SQL Editor 또는 마이그레이션 파이프라인
-- ============================================================

-- ── saved_todo 테이블 ──────────────────────────────────────
ALTER TABLE saved_todo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 데이터만 조회"
  ON saved_todo FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "사용자 본인 데이터만 생성"
  ON saved_todo FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "사용자 본인 데이터만 수정"
  ON saved_todo FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "사용자 본인 데이터만 삭제"
  ON saved_todo FOR DELETE
  USING (user_id = auth.uid()::text);

-- ── user_usage 테이블 ──────────────────────────────────────
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 사용량만 조회"
  ON user_usage FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "사용자 본인 사용량만 수정"
  ON user_usage FOR UPDATE
  USING (user_id = auth.uid()::text);

-- ── subscriptions 테이블 ───────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 구독만 조회"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid()::text);

-- ── user_consents 테이블 ───────────────────────────────────
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 동의만 조회"
  ON user_consents FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "사용자 본인 동의만 생성/수정"
  ON user_consents FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================
-- 참고: SERVICE_ROLE_KEY를 사용하는 admin 클라이언트는
-- RLS를 우회하므로 기존 서버 측 로직은 영향받지 않습니다.
-- 이 정책은 anon key 클라이언트에 대한 추가 방어 계층입니다.
-- ============================================================
