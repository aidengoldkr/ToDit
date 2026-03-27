import {
  FREE_PLAN_CODE,
  PRO_MONTHLY_AMOUNT,
  PRO_MONTHLY_CURRENCY,
  PRO_PLAN_CODE,
  PRO_PLAN_NAME,
} from "@/lib/billing";
import {
  extractUserIdFromCustomerUid,
  extractUserIdFromMerchantUid,
  getExpectedBillingCurrency,
  getMerchantUid,
  getNextBillingPeriod,
  isCancelledStatus,
  isFailedStatus,
  isPaidStatus,
  normalizePortoneTimestamp,
} from "@/lib/portone/helpers";
import {
  getPaymentByImpUid as getPortonePaymentByImpUid,
  requestBillingPaymentAgain,
} from "@/lib/portone/server";
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

export type ChargeSubscriptionResult =
  | {
      success: true;
      merchantUid: string;
      payment: PortonePayment;
      status: string;
    }
  | {
      success: false;
      merchantUid: string;
      payment?: PortonePayment | null;
      status?: string;
      statusCode: number;
      error: string;
    };

const SUBSCRIPTION_SELECT =
  "user_id, plan, status, customer_uid, pg_provider, billing_key_issued_at, current_period_start, current_period_end, next_billing_at, last_paid_at, cancel_at_period_end, canceled_at, last_payment_status, last_payment_error, metadata, created_at, updated_at";

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

function getLastAppliedImpUid(
  subscription?: SubscriptionRecord | null
): string | null {
  const value = subscription?.metadata?.last_imp_uid;
  return typeof value === "string" ? value : null;
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
    .select(SUBSCRIPTION_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SubscriptionRecord | null) ?? null;
}

export async function getSubscriptionsDueForRenewal(
  nowIso: string
): Promise<SubscriptionRecord[]> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("plan", PRO_PLAN_CODE)
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .lte("next_billing_at", nowIso);

  if (error) {
    throw new Error(error.message);
  }

  return (data as SubscriptionRecord[]) ?? [];
}

export async function getExpiredActiveSubscriptions(
  nowIso: string
): Promise<SubscriptionRecord[]> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("plan", PRO_PLAN_CODE)
    .eq("status", "active")
    .lte("current_period_end", nowIso);

  if (error) {
    throw new Error(error.message);
  }

  return (data as SubscriptionRecord[]) ?? [];
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

  return (
    extractUserIdFromCustomerUid(payment.customer_uid) ||
    extractUserIdFromMerchantUid(payment.merchant_uid)
  );
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
  const alreadyApplied =
    Boolean(params.payment.imp_uid) &&
    getLastAppliedImpUid(subscription) === params.payment.imp_uid &&
    subscription?.last_payment_status === "paid";

  await upsertPaymentRecord(
    buildPaymentRow(params.userId, params.payment, {
      status: "paid",
      fail_reason: null,
      failed_at: null,
      canceled_at: null,
    })
  );

  if (alreadyApplied) {
    return;
  }

  const paidAt = normalizePortoneTimestamp(params.payment.paid_at);
  const period = getNextBillingPeriod({
    paidAt,
    existingPeriodEnd: subscription?.current_period_end ?? null,
  });

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
      subscription_user_id: existing?.subscription_user_id ?? params.userId,
      amount: existing?.amount ?? PRO_MONTHLY_AMOUNT,
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

export async function chargeSubscriptionNow(params: {
  userId: string;
  customerUid: string;
  buyerEmail?: string | null;
  buyerName?: string | null;
  pgProvider?: string | null;
}): Promise<ChargeSubscriptionResult> {
  const merchantUid = getMerchantUid(params.userId);
  await recordPendingChargeAttempt({
    userId: params.userId,
    merchantUid,
    customerUid: params.customerUid,
    amount: PRO_MONTHLY_AMOUNT,
    pgProvider: params.pgProvider,
  });

  let verifiedPayment: PortonePayment;
  try {
    const recurringPayment = await requestBillingPaymentAgain({
      customer_uid: params.customerUid,
      merchant_uid: merchantUid,
      amount: PRO_MONTHLY_AMOUNT,
      name: PRO_PLAN_NAME,
      buyer_email: params.buyerEmail || undefined,
      buyer_name: params.buyerName || undefined,
    });

    verifiedPayment = recurringPayment.imp_uid
      ? await getPortonePaymentByImpUid(recurringPayment.imp_uid).catch(
          () => recurringPayment
        )
      : recurringPayment;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recurring billing failed.";

    await syncFailedPayment({
      userId: params.userId,
      merchantUid,
      customerUid: params.customerUid,
      errorMessage: message,
    }).catch(() => undefined);
    await ensureInactiveSubscription(params.userId).catch(() => undefined);

    return {
      success: false,
      merchantUid,
      statusCode: 502,
      error: message,
    };
  }

  if (isPaidStatus(verifiedPayment.status)) {
    await syncVerifiedPaidPayment({
      userId: params.userId,
      customerUid: params.customerUid,
      payment: verifiedPayment,
    });

    return {
      success: true,
      merchantUid,
      payment: verifiedPayment,
      status: getPaymentStateFromPortone(verifiedPayment),
    };
  }

  if (isCancelledStatus(verifiedPayment.status)) {
    await syncCancelledPayment({
      userId: params.userId,
      payment: verifiedPayment,
    });
    await ensureInactiveSubscription(params.userId).catch(() => undefined);

    return {
      success: false,
      merchantUid,
      payment: verifiedPayment,
      status: getPaymentStateFromPortone(verifiedPayment),
      statusCode: 400,
      error: "Payment was cancelled.",
    };
  }

  const errorMessage =
    verifiedPayment.fail_reason || "Recurring billing request failed.";

  await syncFailedPayment({
    userId: params.userId,
    merchantUid,
    customerUid: params.customerUid,
    payment: verifiedPayment,
    errorMessage,
  });
  await ensureInactiveSubscription(params.userId).catch(() => undefined);

  return {
    success: false,
    merchantUid,
    payment: verifiedPayment,
    status: getPaymentStateFromPortone(verifiedPayment),
    statusCode: 400,
    error: errorMessage,
  };
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
      plan: FREE_PLAN_CODE,
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
