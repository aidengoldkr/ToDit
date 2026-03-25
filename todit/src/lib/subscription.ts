import {
  getSubscriptionByUserId,
  isSubscriptionActivePro,
} from "@/lib/billing/service";
import { PRO_PLAN_CODE } from "@/lib/billing";
import { FREE_IMAGE_LIMIT, PRO_IMAGE_LIMIT, type PlanTier } from "@/lib/plan-policy";
import { createAdminClient } from "@/lib/supabase/admin";

const PLAN_LIMIT = 10;
const FREE_PLAN_LIMIT = PLAN_LIMIT;
const PRO_PLAN_LIMIT = PLAN_LIMIT;

export async function getTier(userId: string): Promise<PlanTier> {
  const subscription = await getSubscriptionByUserId(userId).catch(() => null);
  return isSubscriptionActivePro(subscription) ? "pro" : "free";
}

export async function activateSubscription(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan: PRO_PLAN_CODE,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: nextMonth.toISOString(),
        next_billing_at: nextMonth.toISOString(),
        last_paid_at: now.toISOString(),
        cancel_at_period_end: false,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" }
    );

  return !error;
}

export function getPlanLimit(_tier: PlanTier): number {
  return PLAN_LIMIT;
}

export function getImageLimit(tier: PlanTier): number {
  return tier === "pro" ? PRO_IMAGE_LIMIT : FREE_IMAGE_LIMIT;
}

export type { PlanTier } from "@/lib/plan-policy";
export { PLAN_LIMIT, FREE_PLAN_LIMIT, FREE_IMAGE_LIMIT, PRO_IMAGE_LIMIT, PRO_PLAN_LIMIT };
