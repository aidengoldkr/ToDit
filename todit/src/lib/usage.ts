import { createAdminClient } from "@/lib/supabase/admin";
import { getTier } from "@/lib/subscription";

export const FREE_MONTHLY_LIMIT = 20;
const MAX_USAGE_UPDATE_RETRIES = 5;

export type UserUsage = {
  count: number;
  limit: number | null;
  last_reset_at: string;
};

type UsageRow = {
  balance: number;
  last_refill_at: string;
};

async function getUsageRow(
  userId: string,
  displayName?: string | null
): Promise<UsageRow | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const namePayload =
    displayName != null && displayName !== ""
      ? { name: displayName }
      : {};

  const { data: existing } = await supabase
    .from("users")
    .select("balance, last_refill_at")
    .eq("id", userId)
    .single();

  if (existing) {
    const lastRefill = existing.last_refill_at ? new Date(existing.last_refill_at) : null;
    const lastMonth = lastRefill
      ? new Date(lastRefill.getFullYear(), lastRefill.getMonth(), 1).toISOString()
      : null;

    if (lastMonth && lastMonth < thisMonth) {
      await supabase
        .from("users")
        .update({
          balance: 0,
          last_refill_at: thisMonth,
          updated_at: now.toISOString(),
          ...namePayload,
        })
        .eq("id", userId);

      return {
        balance: 0,
        last_refill_at: thisMonth,
      };
    }

    if (Object.keys(namePayload).length > 0) {
      await supabase
        .from("users")
        .update({
          updated_at: now.toISOString(),
          ...namePayload,
        })
        .eq("id", userId);
    }

    return {
      balance: existing.balance ?? 0,
      last_refill_at: existing.last_refill_at ?? thisMonth,
    };
  }

  const { data: inserted } = await supabase
    .from("users")
    .insert({
      id: userId,
      balance: 0,
      last_refill_at: thisMonth,
      provider: "google",
      ...namePayload,
    })
    .select("balance, last_refill_at")
    .single();

  if (!inserted) return null;

  return {
    balance: inserted.balance ?? 0,
    last_refill_at: inserted.last_refill_at ?? thisMonth,
  };
}

export async function getOrResetUsage(
  userId: string,
  displayName?: string | null
): Promise<UserUsage | null> {
  const tier = await getTier(userId);
  const usage = await getUsageRow(userId, displayName);
  if (!usage) return null;

  return {
    count: usage.balance,
    limit: tier === "pro" ? null : FREE_MONTHLY_LIMIT,
    last_reset_at: usage.last_refill_at,
  };
}

export async function reserveFreeUsage(
  userId: string,
  displayName?: string | null
): Promise<"reserved" | "limit_exceeded" | "error"> {
  const supabase = createAdminClient();
  if (!supabase) return "error";

  for (let attempt = 0; attempt < MAX_USAGE_UPDATE_RETRIES; attempt += 1) {
    const usage = await getUsageRow(userId, displayName);
    if (!usage) return "error";

    if (usage.balance >= FREE_MONTHLY_LIMIT) {
      return "limit_exceeded";
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        balance: usage.balance + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("balance", usage.balance)
      .select("balance")
      .maybeSingle();

    if (!error && data) {
      return "reserved";
    }
  }

  return "error";
}

export async function releaseFreeUsage(userId: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  for (let attempt = 0; attempt < MAX_USAGE_UPDATE_RETRIES; attempt += 1) {
    const usage = await getUsageRow(userId);
    if (!usage || usage.balance <= 0) {
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        balance: usage.balance - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("balance", usage.balance)
      .select("balance")
      .maybeSingle();

    if (!error && data) {
      return;
    }
  }
}

export async function incrementUsage(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;

  const tier = await getTier(userId);
  if (tier === "pro") {
    const usage = await getUsageRow(userId);
    if (!usage) return false;

    const { error } = await supabase
      .from("users")
      .update({
        balance: usage.balance + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return !error;
  }

  return (await reserveFreeUsage(userId)) === "reserved";
}
