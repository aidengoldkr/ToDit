import { createAdminClient } from "@/lib/supabase/admin";

/** 해당 사용자가 이용약관·개인정보처리방침에 동의했는지 여부. DB 미설정 시 true(동의로 간주). */
export async function getTermsAgreed(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return true;
  const { data } = await supabase
    .from("user_consents")
    .select("terms_agreed_at")
    .eq("user_id", userId)
    .single();
  return !!data?.terms_agreed_at;
}

/** 이용약관·개인정보처리방침 동의 기록. 실패 시 예외 발생. */
export async function setTermsAgreed(userId: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  const { error } = await supabase.from("user_consents").upsert(
    { user_id: userId, terms_agreed_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}
