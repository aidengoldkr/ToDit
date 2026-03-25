export const PRO_PLAN_CODE = "pro";
export const FREE_PLAN_CODE = "free";
export const PRO_MONTHLY_AMOUNT = 2900;
export const PRO_MONTHLY_CURRENCY = "KRW";
export const PRO_MONTHLY_PRICE_LABEL = "₩2,900 / 월";
export const PRO_PLAN_NAME = "ToDit Pro 월간 구독";
export const PAY_TEST_ALLOWED_USER_IDS = new Set([
  "110754191303165301969",
  "669f8701-2a1d-4094-9ec1-6a690b8b28f6",
]);

export function getUpgradeHref(isAuthenticated: boolean): string {
  if (isAuthenticated) {
    return "/plan";
  }

  return `/auth/signin?callbackUrl=${encodeURIComponent("/plan")}`;
}

export function isPayTestEnabled(): boolean {
  return process.env.PAY_TEST?.toLowerCase() === "true";
}

export function isPayTestAllowedUser(userId?: string | null): boolean {
  if (!userId) {
    return false;
  }

  return PAY_TEST_ALLOWED_USER_IDS.has(userId);
}
