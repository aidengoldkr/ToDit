import { createAdminClient } from "@/lib/supabase/admin";

export type PlanTier = "free" | "pro";

/** 모든 사용자 공통: 액션 플랜 최대 개수 */
const PLAN_LIMIT = 10;
const FREE_PLAN_LIMIT = PLAN_LIMIT;
const PRO_PLAN_LIMIT = PLAN_LIMIT;
const FREE_IMAGE_LIMIT = 5;
const PRO_IMAGE_LIMIT = 50;

/** 사용자 티어 조회 (Pro: active 구독만) */
export async function getTier(userId: string): Promise<PlanTier> {
  const supabase = createAdminClient();
  if (!supabase) return "free";

  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .single();

  if (!data) return "free";
  if (data.status !== "active") return "free";
  const end = data.current_period_end ? new Date(data.current_period_end) : null;
  if (end && end.getTime() < Date.now()) return "free"; // 만료
  return "pro";
}

/** 행동 플랜 생성 가능 개수 (모든 사용자 10개로 제한) */
export function getPlanLimit(_tier: PlanTier): number {
  return PLAN_LIMIT;
}

/** 플랜당 이미지 첨부 가능 개수 */
export function getImageLimit(tier: PlanTier): number {
  return tier === "pro" ? PRO_IMAGE_LIMIT : FREE_IMAGE_LIMIT;
}

export { PLAN_LIMIT, FREE_PLAN_LIMIT, FREE_IMAGE_LIMIT, PRO_IMAGE_LIMIT };
