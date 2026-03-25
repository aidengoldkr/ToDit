import {
  FREE_PLAN_CODE,
  PRO_MONTHLY_CURRENCY,
  PRO_PLAN_CODE,
} from "@/lib/billing";
import {
  extractUserIdFromMerchantUid,
  getExpectedBillingCurrency,
  getNextBillingPeriod,
  isCancelledStatus,
  isFailedStatus,
  normalizePortoneTimestamp,
} from "@/lib/portone/helpers";
import type { PortonePayment } from "@/lib/portone/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type SubscriptionRecord = {
  user_id: string;
  plan: string | null;
  status: string | null;
  customer_uid: string | null;
  pg_provider: string | null;
  billing_key_issued_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  last_paid_at: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  last_payment_status: string | null;
  last_payment_error: string | null;
  metadata: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaymentRecord = {
  id?: string;
  user_id: string;
  merchant_uid: string;
  imp_uid: string | null;
  customer_uid: string | null;
  subscription_user_id: string | null;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  failed_at: string | null;
  canceled_at: string | null;
  fail_reason: string | null;
  pg_provider: string | null;
  pay_method: string | null;
  receipt_url: string | null;
  raw_response: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

function getAdmin() {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is unavailable.");
  }

  return supabase;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function isSubscriptionActivePro(
  subscription?: SubscriptionRecord | null
): boolean {
  if (!subscription) {
    return false;
  }

  if (subscription.plan !== PRO_PLAN_CODE || subscription.status !== "active") {
    return false;
  }

  if (!subscription.current_period_end) {
    return false;
  }

  return new Date(subscription.current_period_end).getTime() > Date.now();
}

export async function getSubscriptionByUserId(
  userId: string
): Promise<SubscriptionRecord | null> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "user_id, plan, status, customer_uid, pg_provider, billing_key_issued_at, current_period_start, current_period_end, next_billing_at, last_paid_at, cancel_at_period_end, canceled_at, last_payment_status, last_payment_error, metadata, created_at, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SubscriptionRecord | null) ?? null;
}

export async function getPaymentByMerchantUid(
  merchantUid: string
): Promise<PaymentRecord | null> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("merchant_uid", merchantUid)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PaymentRecord | null) ?? null;
}

export async function getPaymentByImpUid(
  impUid: string
): Promise<PaymentRecord | null> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("imp_uid", impUid)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PaymentRecord | null) ?? null;
}

export async function resolveUserIdFromVerifiedPayment(
  payment: PortonePayment
): Promise<string | null> {
  if (payment.customer_uid) {
    const supabase = getAdmin();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("customer_uid", payment.customer_uid)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data?.user_id) {
      return data.user_id as string;
    }
  }

  const existingPayment = payment.merchant_uid
    ? await getPaymentByMerchantUid(payment.merchant_uid)
    : null;
  if (existingPayment?.user_id) {
    return existingPayment.user_id;
  }

  return extractUserIdFromMerchantUid(payment.merchant_uid);
}

function buildPaymentRow(
  userId: string,
  payment: PortonePayment,
  overrides?: Partial<PaymentRecord>
): PaymentRecord {
  return {
    user_id: userId,
    merchant_uid: payment.merchant_uid,
    imp_uid: payment.imp_uid ?? null,
    customer_uid: payment.customer_uid ?? null,
    subscription_user_id: userId,
    amount: payment.amount,
    currency: payment.currency || getExpectedBillingCurrency(),
    status: payment.status,
    paid_at: normalizePortoneTimestamp(payment.paid_at),
    failed_at: normalizePortoneTimestamp(payment.failed_at),
    canceled_at: normalizePortoneTimestamp(payment.cancelled_at),
    fail_reason: payment.fail_reason || payment.cancel_reason || null,
    pg_provider: payment.pg_provider || null,
    pay_method: payment.pay_method || null,
    receipt_url: payment.receipt_url || null,
    raw_response: asObject(payment),
    ...overrides,
  };
}

export async function upsertPaymentRecord(record: PaymentRecord): Promise<void> {
  const supabase = getAdmin();
  const existing = await getPaymentByMerchantUid(record.merchant_uid);
  const payload = {
    ...record,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("payments")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await supabase.from("payments").insert({
    ...payload,
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function recordPendingChargeAttempt(params: {
  userId: string;
  merchantUid: string;
  customerUid: string;
  amount: number;
  pgProvider?: string | null;
}): Promise<void> {
  await upsertPaymentRecord({
    user_id: params.userId,
    merchant_uid: params.merchantUid,
    imp_uid: null,
    customer_uid: params.customerUid,
    subscription_user_id: params.userId,
    amount: params.amount,
    currency: PRO_MONTHLY_CURRENCY,
    status: "pending",
    paid_at: null,
    failed_at: null,
    canceled_at: null,
    fail_reason: null,
    pg_provider: params.pgProvider ?? null,
    pay_method: "card",
    receipt_url: null,
    raw_response: {},
  });
}

export async function syncVerifiedPaidPayment(params: {
  userId: string;
  customerUid: string;
  payment: PortonePayment;
}): Promise<void> {
  const subscription = await getSubscriptionByUserId(params.userId);
  const paidAt = normalizePortoneTimestamp(params.payment.paid_at);
  const period = getNextBillingPeriod({
    paidAt,
    existingPeriodEnd: subscription?.current_period_end ?? null,
  });

  await upsertPaymentRecord(
    buildPaymentRow(params.userId, params.payment, {
      status: "paid",
      fail_reason: null,
      failed_at: null,
      canceled_at: null,
    })
  );

  const supabase = getAdmin();
  const metadata = {
    ...(subscription?.metadata ?? {}),
    last_imp_uid: params.payment.imp_uid,
    last_merchant_uid: params.payment.merchant_uid,
  };
  const payload: SubscriptionRecord = {
    user_id: params.userId,
    plan: PRO_PLAN_CODE,
    status: "active",
    customer_uid: params.customerUid,
    pg_provider: params.payment.pg_provider || subscription?.pg_provider || null,
    billing_key_issued_at:
      subscription?.billing_key_issued_at ||
      paidAt ||
      new Date().toISOString(),
    current_period_start: period.current_period_start,
    current_period_end: period.current_period_end,
    next_billing_at: period.next_billing_at,
    last_paid_at: paidAt || new Date().toISOString(),
    cancel_at_period_end: false,
    canceled_at: null,
    last_payment_status: "paid",
    last_payment_error: null,
    metadata,
  };

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        ...payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncFailedPayment(params: {
  userId: string;
  merchantUid: string;
  customerUid?: string | null;
  payment?: PortonePayment | null;
  errorMessage: string;
}): Promise<void> {
  const payment = params.payment;

  if (payment) {
    await upsertPaymentRecord(
      buildPaymentRow(params.userId, payment, {
        status: isCancelledStatus(payment.status)
          ? "cancelled"
          : isFailedStatus(payment.status)
            ? "failed"
            : payment.status || "failed",
        fail_reason:
          payment.fail_reason ||
          payment.cancel_reason ||
          params.errorMessage,
      })
    );
  } else {
    const existing = await getPaymentByMerchantUid(params.merchantUid);
    await upsertPaymentRecord({
      id: existing?.id,
      user_id: params.userId,
      merchant_uid: params.merchantUid,
      imp_uid: existing?.imp_uid ?? null,
      customer_uid: params.customerUid ?? existing?.customer_uid ?? null,
      subscription_user_id:
        existing?.subscription_user_id ?? params.userId,
      amount: existing?.amount ?? 0,
      currency: existing?.currency ?? PRO_MONTHLY_CURRENCY,
      status: "failed",
      paid_at: existing?.paid_at ?? null,
      failed_at: new Date().toISOString(),
      canceled_at: existing?.canceled_at ?? null,
      fail_reason: params.errorMessage,
      pg_provider: existing?.pg_provider ?? null,
      pay_method: existing?.pay_method ?? "card",
      receipt_url: existing?.receipt_url ?? null,
      raw_response: existing?.raw_response ?? {},
    });
  }

  const subscription = await getSubscriptionByUserId(params.userId);
  if (!subscription) {
    return;
  }

  const supabase = getAdmin();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      last_payment_status: payment?.status || "failed",
      last_payment_error: params.errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncCancelledPayment(params: {
  userId: string;
  payment: PortonePayment;
}): Promise<void> {
  await upsertPaymentRecord(
    buildPaymentRow(params.userId, params.payment, {
      status: "cancelled",
      canceled_at:
        normalizePortoneTimestamp(params.payment.cancelled_at) ||
        new Date().toISOString(),
      fail_reason: params.payment.cancel_reason || null,
    })
  );

  const subscription = await getSubscriptionByUserId(params.userId);
  if (!subscription) {
    return;
  }

  const supabase = getAdmin();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      last_payment_status: "cancelled",
      last_payment_error: params.payment.cancel_reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function cancelSubscriptionAtPeriodEnd(
  userId: string
): Promise<SubscriptionRecord | null> {
  const subscription = await getSubscriptionByUserId(userId);
  if (!subscription) {
    return null;
  }

  const supabase = getAdmin();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return getSubscriptionByUserId(userId);
}

export async function ensureInactiveSubscription(
  userId: string
): Promise<void> {
  const subscription = await getSubscriptionByUserId(userId);
  if (!subscription) {
    return;
  }

  if (isSubscriptionActivePro(subscription)) {
    return;
  }

  const supabase = getAdmin();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan: subscription.plan || FREE_PLAN_CODE,
      status: "inactive",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export function getPaymentStateFromPortone(payment: PortonePayment): string {
  if (payment.status === "paid") {
    return "paid";
  }

  if (isCancelledStatus(payment.status)) {
    return "cancelled";
  }

  return payment.status || "failed";
}
