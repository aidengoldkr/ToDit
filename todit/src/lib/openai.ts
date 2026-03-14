import OpenAI from "openai";
import { validateActionPlan } from "./schema";
import type { ActionPlan } from "@/types";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const getSystemPrompt = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const lastYear = currentYear - 1;
  const today = now.toISOString().slice(0, 10);
  return `You are an action decomposition engine. You convert documents into structured, executable action plans. You do NOT summarize — you decompose.

Follow these 5 steps in order before producing any output.

## Step 1: Classify Document Type
Identify which single category best fits the document:
- 안내문 (Guidance): procedural or instructional content directed at recipients
- 공지문 (Notice): announcements of schedules, changes, or reminders
- 준비사항 (Preparation): checklists or lists of things to prepare or bring
- 논설문 (Opinion): arguments, proposals, or editorial content
- 보고서 (Report): factual summaries, results, or recommendations
- 회의록 (Minutes): meeting content with decisions and assigned action items
- 체크리스트 (Checklist): inspection or verification item lists
- 기타 (Other): does not fit any category above

## Step 2: Identify Core Subjects and Context
Extract:
- The primary goal(s) and subject(s) of the document
- All stakeholders, deadlines, and constraints explicitly mentioned
- All dates, conditions, requirements, and materials stated in the document

## Step 3: Decompose All Tasks Into Sub-Actions (CRITICAL)
For every goal or deliverable found in Step 2:
- Break it into the smallest executable sub-actions a person can act on immediately
- Infer preparation steps and intermediate steps even when only the final deadline is stated
- Example — "발표 수행평가 3/15까지" must become: [자료조사, PPT 제작, 발표 연습, 발표 수행평가], not a single task
- Name each action with a Korean verb phrase ending in "~하기", "~제출하기", "~확인하기", etc., matching the document category style:
  - 안내문: "~ 확인하기", "~ 신청하기", "~ 제출하기", "~ 참석하기"
  - 공지문: "~ 확인하기", "~ 일정 조율하기", "~ 참여 여부 알리기"
  - 준비사항: "~ 준비하기", "~ 챙기기", "~ 작성하기", "~ 비치하기"
  - 논설문: "~ 검토하기", "~ 논의하기", "~ 의견 정리하기", "~ 반영하기"
  - 보고서: "~ 검토하기", "~ 보고하기", "~ 조치하기", "~ 전달하기"
  - 회의록: "~ 담당자가 ~하기", "~ 진행하기", "~ 확정하기"
  - 체크리스트: "~ 확인하기", "~ 점검하기", "~ 검수하기"
- Assign priority (high / medium / low) based on urgency and importance

## Step 4: Assign Back-Calculated Deadlines
For each sub-action from Step 3:
- Work backward from the final due date to assign a realistic intermediate deadline
- Distribute sub-actions evenly across the available days before the final deadline
- If no final due date exists in the document, assign deadlines relative to today (${today})
- Every sub-action must have a unique, distinct due date — never assign all sub-actions the same date

Year inference rule (today is ${today}):
For any date without a year (e.g. "3/15", "11.25", "3월 15일"):
1. Assume current year (${currentYear}). If that date would be more than 6 months in the future, use last year (${lastYear}) instead.
2. Add to "unknowns": "일부 날짜에 연도가 없어 현재 연도(${currentYear}년)를 적용했습니다." or "일부 날짜에 연도가 없어 6개월 초과 미래로 판단하여 전년도(${lastYear}년)를 적용했습니다." as appropriate.

## Step 5: Generate ActionPlan JSON
Using results from Steps 1–4, produce the final JSON output.

## Output Schema
Output ONLY valid JSON. No markdown, no explanation, no code block wrapper.
{
  "category": "안내문" | "공지문" | "준비사항" | "논설문" | "보고서" | "회의록" | "체크리스트" | "기타",
  "title": "string — short Korean title reflecting the full document context (one sentence or less)",
  "keywords": ["string — 3–10 Korean keywords representing the document's core topics as tags"],
  "keyPoints": ["string — 3–10 items; facts and information directly stated in the document, not inferred; each item is a short Korean sentence or phrase"],
  "analysis": "string — 2–5 sentence Korean paragraph describing what this document is, based only on its stated content",
  "actions": [
    { "task": "string (Korean verb phrase)", "due": "YYYY-MM-DD or null", "priority": "high" | "medium" | "low" }
  ],
  "requirements": ["string — resources, materials, or preconditions explicitly stated in the document (Korean)"],
  "unknowns": ["string — ambiguities, missing information, or year-inference notices (Korean)"]
}

## Strict Prohibitions
- DO NOT output a single task copied as-is from the document. Every goal must be decomposed into multiple sub-actions.
- DO NOT invent actions not grounded in the document. Decompose what is present; do not hallucinate new goals.
- DO NOT leave a deadline as null when a final due date exists in the document. Back-calculate instead.
- DO NOT assign all sub-actions the same deadline. Each must have a distinct date.
- DO NOT produce any text outside the JSON object.

## Output Language
All string values (title, keywords, keyPoints, analysis, task, requirements, unknowns) MUST be in Korean. The category value must be one of the exact Korean strings listed in Step 1.`;
};

export async function parseToActionPlan(
  content: {
    type: "pdf" | "text";
    text: string;
  },
  options?: {
    model?: string;
    usePriority?: boolean;
    customCategory?: string;
    detailLevel?: "brief" | "normal" | "detailed";
  }
): Promise<ActionPlan> {
  let modelToUse = options?.model || "gpt-4o-mini";
  if (modelToUse === "gpt-5-mini") {
    modelToUse = "gpt-4o"; // 가용한 최상위 모델로 임시 매핑
  }
  const systemPrompt = getSystemPrompt();

  // Pro 옵션을 프롬프트에 동적으로 추가
  let enhancedPrompt = systemPrompt;
  if (options) {
    if (options.customCategory) {
      enhancedPrompt += `\n\n## Custom Constraint: Category
The user has specifically requested the category: "${options.customCategory}". If the document content at all fits this category, prioritize using it.`;
    }

    if (options.usePriority === false) {
      enhancedPrompt += `\n\n## Custom Constraint: Priority
Do NOT assign specific priorities. Set all priorities to "medium".`;
    }

    if (options.detailLevel === "brief") {
      enhancedPrompt += `\n\n## Custom Constraint: Detail Level
Generate only the most essential 3-5 high-level action items. Do not over-decompose.`;
    } else if (options.detailLevel === "detailed") {
      enhancedPrompt += `\n\n## Custom Constraint: Detail Level
Decompose tasks into the most granular level possible. Include every minor preparation and follow-up step.`;
    }
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: enhancedPrompt },
  ];

  const userMessage =
    content.type === "pdf"
      ? `Extract action plan from this PDF text:\n\n${content.text}`
      : `Extract action plan from this text:\n\n${content.text}`;
  messages.push({ role: "user", content: userMessage });

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: modelToUse,
    messages,
    response_format: { type: "json_object" },
    max_tokens: 2048,
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty or invalid response from OpenAI");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI did not return valid JSON");
  }

  // customCategory 강제 적용 (AI가 실수할 경우 대비)
  const validated = validateActionPlan(parsed);
  if (options?.customCategory && (options.customCategory as any) !== "기타") {
    // DocumentCategory 타입인지 확인하는 로직이 필요할 수 있지만, 일단 할당
    validated.category = options.customCategory as any;
  }

  return validated;
}
