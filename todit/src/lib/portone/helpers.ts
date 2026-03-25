import {
  PRO_MONTHLY_AMOUNT,
  PRO_MONTHLY_CURRENCY,
} from "@/lib/billing";
import type { PortonePaymentStatus } from "@/lib/portone/types";

export function getCustomerUid(userId: string): string {
  return `todit_${userId}`;
}

export function getMerchantUid(userId: string): string {
  return `todit_pro_${userId}_${Date.now()}`;
}

export function buildBillingWebhookUrl(baseUrl?: string): string {
  const origin =
    baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "";

  return `${origin.replace(/\/$/, "")}/api/billing/webhook`;
}

export function getExpectedBillingAmount(): number {
  return PRO_MONTHLY_AMOUNT;
}

export function getExpectedBillingCurrency(): string {
  return PRO_MONTHLY_CURRENCY;
}

export function normalizePortoneTimestamp(
  value?: number | null
): string | null {
  if (!value) {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

export function isPaidStatus(status?: PortonePaymentStatus | null): boolean {
  return status === "paid";
}

export function isFailedStatus(status?: PortonePaymentStatus | null): boolean {
  return status === "failed";
}

export function isCancelledStatus(
  status?: PortonePaymentStatus | null
): boolean {
  return status === "cancelled" || status === "cancel_requested";
}

export function isBillingAmountValid(amount: number): boolean {
  return amount === getExpectedBillingAmount();
}

function addMonths(base: Date, months: number): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function getNextBillingPeriod(options?: {
  paidAt?: string | null;
  existingPeriodEnd?: string | null;
}): {
  current_period_start: string;
  current_period_end: string;
  next_billing_at: string;
} {
  const paidAtDate = options?.paidAt ? new Date(options.paidAt) : new Date();
  const existingEndDate = options?.existingPeriodEnd
    ? new Date(options.existingPeriodEnd)
    : null;
  const now = new Date();

  const effectiveStart =
    existingEndDate && existingEndDate.getTime() > now.getTime()
      ? existingEndDate
      : paidAtDate;
  const effectiveEnd = addMonths(effectiveStart, 1);

  return {
    current_period_start: effectiveStart.toISOString(),
    current_period_end: effectiveEnd.toISOString(),
    next_billing_at: effectiveEnd.toISOString(),
  };
}

export function extractUserIdFromMerchantUid(
  merchantUid?: string | null
): string | null {
  if (!merchantUid) {
    return null;
  }

  const match = merchantUid.match(/^todit_pro_(.+)_\d+$/);
  return match?.[1] ?? null;
}
