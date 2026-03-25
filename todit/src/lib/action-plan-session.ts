import type { TodoPlanV2 } from "@/types";

export const ACTION_PLAN_STORAGE_KEY = "todit_last_result";

export function readStoredTodoPlan(userId?: string): TodoPlanV2 | null {
  if (typeof window === "undefined" || !userId) {
    return null;
  }

  const raw = window.sessionStorage.getItem(ACTION_PLAN_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const data = JSON.parse(raw);
    if (data.userId !== userId) {
      return null;
    }
    return data.plan as TodoPlanV2;
  } catch {
    window.sessionStorage.removeItem(ACTION_PLAN_STORAGE_KEY);
    return null;
  }
}

export function writeStoredTodoPlan(plan: TodoPlanV2, userId: string) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  const data = {
    plan,
    userId,
    timestamp: Date.now(),
  };

  window.sessionStorage.setItem(ACTION_PLAN_STORAGE_KEY, JSON.stringify(data));
}

export function clearStoredTodoPlan() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(ACTION_PLAN_STORAGE_KEY);
}
