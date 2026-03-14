import { createAdminClient } from "@/lib/supabase/admin";
import { getTier, type PlanTier } from "@/lib/subscription";

export const FREE_MONTHLY_LIMIT = 20;

export type UserUsage = {
  count: number;
  limit: number | null; // null means unlimited
  last_reset_at: string;
};

/** 사용량 조회 및 월별 초기화 적용 */
export async function getOrResetUsage(
  userId: string,
  displayName?: string | null
): Promise<UserUsage | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const tier = await getTier(userId);
  const limit = tier === "pro" ? null : FREE_MONTHLY_LIMIT;

  const { data: existing } = await supabase
    .from("user_usage")
    .select("balance, last_refill_at")
    .eq("user_id", userId)
    .single();

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const namePayload =
    displayName != null && displayName !== ""
      ? { display_name: displayName }
      : {};

  if (existing) {
    const lastRefill = existing.last_refill_at ? new Date(existing.last_refill_at) : null;
    const lastMonth = lastRefill
      ? new Date(lastRefill.getFullYear(), lastRefill.getMonth(), 1).toISOString()
      : null;

    // 달이 바뀌었으면 count(balance)를 0으로 초기화
    if (lastMonth && lastMonth < thisMonth) {
      await supabase
        .from("user_usage")
        .update({
          balance: 0,
          last_refill_at: thisMonth,
          updated_at: now.toISOString(),
          ...namePayload,
        })
        .eq("user_id", userId);
      return { count: 0, limit, last_reset_at: thisMonth };
    }

    if (Object.keys(namePayload).length > 0) {
      await supabase
        .from("user_usage")
        .update({ updated_at: now.toISOString(), ...namePayload })
        .eq("user_id", userId);
    }

    return {
      count: existing.balance ?? 0,
      limit,
      last_reset_at: existing.last_refill_at ?? thisMonth,
    };
  }

  // 신규 유저 생성
  const { data: inserted } = await supabase
    .from("user_usage")
    .insert({
      user_id: userId,
      balance: 0, // 초기 사용량 0
      last_refill_at: thisMonth,
      ...namePayload,
    })
    .select("balance, last_refill_at")
    .single();

  if (!inserted) return null;
  return {
    count: inserted.balance ?? 0,
    limit,
    last_reset_at: inserted.last_refill_at ?? thisMonth,
  };
}

/** 사용량 1회 증가 */
export async function incrementUsage(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;

  const tier = await getTier(userId);
  if (tier === "pro") {
    // Pro는 카운트만 올리고 제한 체크 안 함 (또는 통계용으로만 유지)
    const { data: row } = await supabase
      .from("user_usage")
      .select("balance")
      .eq("user_id", userId)
      .single();

    await supabase
      .from("user_usage")
      .update({
        balance: (row?.balance ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return true;
  }

  // Free 사용자 체크
  const { data: row } = await supabase
    .from("user_usage")
    .select("balance")
    .eq("user_id", userId)
    .single();

  const currentCount = row?.balance ?? 0;
  if (currentCount >= FREE_MONTHLY_LIMIT) return false;

  const { error } = await supabase
    .from("user_usage")
    .update({
      balance: currentCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return !error;
}
