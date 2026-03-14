import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ 보안 경고: SERVICE_ROLE_KEY를 사용하는 관리자 클라이언트입니다.
 * RLS(Row Level Security)를 우회하므로 반드시 서버 측에서만 사용하세요.
 * 사용자별 데이터 접근 시에는 반드시 수동 소유권 검증이 필요합니다.
 * 일반 사용자 작업에는 client.ts의 getSupabaseClient()를 사용하세요.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function createAdminClient() {
  return getAdminClient();
}
