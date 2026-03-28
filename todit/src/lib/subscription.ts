import { FREE_IMAGE_LIMIT, PRO_IMAGE_LIMIT, type PlanTier } from "@/lib/plan-policy";
import { createAdminClient } from "@/lib/supabase/admin";

const PLAN_LIMIT = 10;
const FREE_PLAN_LIMIT = PLAN_LIMIT;
const PRO_PLAN_LIMIT = PLAN_LIMIT;
const PRO_PLAN_CODE = "pro";

export async function getTier(userId: string): Promise<PlanTier> {
  const supabase = createAdminClient();
  if (!supabase) {
    return "free";
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return "free";
  }

  const isActivePro =
    data.plan === PRO_PLAN_CODE &&
    data.status === "active" &&
    typeof data.current_period_end === "string" &&
    new Date(data.current_period_end).getTime() > Date.now();

  return isActivePro ? "pro" : "free";
}

export function getPlanLimit(_tier: PlanTier): number {
  return PLAN_LIMIT;
}

export function getImageLimit(tier: PlanTier): number {
  return tier === "pro" ? PRO_IMAGE_LIMIT : FREE_IMAGE_LIMIT;
}

export type { PlanTier } from "@/lib/plan-policy";
export { PLAN_LIMIT, FREE_PLAN_LIMIT, FREE_IMAGE_LIMIT, PRO_IMAGE_LIMIT, PRO_PLAN_LIMIT };
