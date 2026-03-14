import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * RLS(Row Level Security)를 준수하는 표준 Supabase 클라이언트.
 * anon key를 사용하므로 RLS 정책이 자동으로 적용됩니다.
 *
 * ⚠️ 관리자 작업(cross-user 또는 서비스 레벨)에는 admin.ts를 사용하세요.
 */
let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  cachedClient = createClient(url, anonKey);
  return cachedClient;
}
