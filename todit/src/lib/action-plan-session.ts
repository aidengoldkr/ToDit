import type { ActionPlan } from "@/types";

export const ACTION_PLAN_STORAGE_KEY = "todit_last_result";

export function readStoredActionPlan(userId?: string): ActionPlan | null {
  if (typeof window === "undefined" || !userId) {
    return null;
  }

  const raw = window.sessionStorage.getItem(ACTION_PLAN_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const data = JSON.parse(raw);
    // 현재 로그인한 사용자와 데이터 소유자가 일치하는지 확인
    if (data.userId !== userId) {
      return null;
    }
    return data.plan as ActionPlan;
  } catch {
    window.sessionStorage.removeItem(ACTION_PLAN_STORAGE_KEY);
    return null;
  }
}

export function writeStoredActionPlan(plan: ActionPlan, userId: string) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  const data = {
    plan,
    userId,
    timestamp: Date.now()
  };

  window.sessionStorage.setItem(ACTION_PLAN_STORAGE_KEY, JSON.stringify(data));
}

export function clearStoredActionPlan() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(ACTION_PLAN_STORAGE_KEY);
}
