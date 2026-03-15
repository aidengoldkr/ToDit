import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * 🔐 인증된 사용자 전용 Supabase 클라이언트
 * 
 * 서비스 롤(admin) 대신 anon key를 사용하며, 
 * HTTP 헤더 'x-todit-user-id'에 현재 로그인한 사용자 ID를 담아 보냅니다.
 * 이 헤더는 DB의 RLS 정책에서 소유권 확인에 사용됩니다.
 */
export function getAuthenticatedClient(userId: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        "x-todit-user-id": userId,
      },
    },
  });
}
