import type { ActionPlan, ActionItem, Priority, DocumentCategory } from "@/types";

const PRIORITIES: Priority[] = ["high", "medium", "low"];
const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "안내문",
  "공지문",
  "준비사항",
  "논설문",
  "보고서",
  "회의록",
  "체크리스트",
  "기타",
];

function isPriority(s: unknown): s is Priority {
  return typeof s === "string" && PRIORITIES.includes(s as Priority);
}

function parseCategory(s: unknown): DocumentCategory {
  return typeof s === "string" && DOCUMENT_CATEGORIES.includes(s as DocumentCategory)
    ? (s as DocumentCategory)
    : "기타";
}

function parseAction(item: unknown): ActionItem | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const task = typeof o.task === "string" ? o.task : "";
  const due = o.due == null ? null : typeof o.due === "string" ? o.due : null;
  const priority = isPriority(o.priority) ? o.priority : "medium";
  const done = o.done === true;
  return { task, due, priority, done };
}

export function validateActionPlan(data: unknown): ActionPlan {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid JSON: expected an object");
  }
  const o = data as Record<string, unknown>;

  const category = parseCategory(o.category);

  const actionsRaw = Array.isArray(o.actions) ? o.actions : [];
  let actions: ActionItem[] = actionsRaw
    .map(parseAction)
    .filter((a): a is ActionItem => a !== null);

  // 날짜 없는 행동 → 시행일(가장 이른 마감일) 이전 임의 날로 설정 (사용자가 수정 가능)
  const withDue = actions.filter((a) => a.due);
  const earliestDue =
    withDue.length > 0
      ? withDue.reduce((min, a) => ((a.due as string) < min ? (a.due as string) : min), withDue[0].due as string)
      : null;
  const today = new Date();
  const baseDate = earliestDue ? new Date(earliestDue + "T12:00:00") : today;
  const dayBefore = new Date(baseDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const fallbackDate = dayBefore.toISOString().slice(0, 10);
  actions = actions.map((a) => (a.due == null ? { ...a, due: fallbackDate } : a));

  const requirements = Array.isArray(o.requirements)
    ? (o.requirements as unknown[]).filter((r): r is string => typeof r === "string")
    : [];

  const unknowns = Array.isArray(o.unknowns)
    ? (o.unknowns as unknown[]).filter((u): u is string => typeof u === "string")
    : [];

  const analysis = typeof o.analysis === "string" ? o.analysis : "";
  const title = typeof o.title === "string" ? o.title : "";
  const keywords = Array.isArray(o.keywords)
    ? (o.keywords as unknown[]).filter((k): k is string => typeof k === "string")
    : [];
  const keyPoints = Array.isArray(o.keyPoints)
    ? (o.keyPoints as unknown[]).filter((k): k is string => typeof k === "string")
    : [];

  return { category, title, analysis, keywords, keyPoints, actions, requirements, unknowns };
}
