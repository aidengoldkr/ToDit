import OpenAI from "openai";
import { hydrateTodoTree, normalizeDraftTodoPlanInput } from "./schema";
import type { TodoPlanV2 } from "@/types";

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

  return `You are a todo decomposition engine for ToDit. You convert documents into a root todo and executable child todos.

Follow these rules before producing output.

## Step 1: Classify the document type
Choose exactly one:
- 안내문
- 공지문
- 준비사항
- 논설문
- 보고서
- 회의록
- 체크리스트
- 기타

## Step 2: Find the main goal
- Create one root todo that represents the single main goal or deliverable.
- The root todo title must be concise Korean text.
- The root todo dueDate is the final deadline of the whole work, if present.
- If there is no clear final deadline, set root dueDate to null.

## Step 3: Decompose only when needed
- If the input already represents a directly executable todo, return root.children as an empty array.
- If the input needs planning, break it into actionable child todos.
- In this version, children should be executable leaf todos. Do not create grandchildren unless absolutely necessary.
- Every child todo title must be a Korean verb phrase that can be acted on immediately.
- Assign dueDate to each child as YYYY-MM-DD or null.
- Assign priority as high, medium, or low.

## Step 4: Meta extraction
- Fill meta.analysis with a 2-5 sentence Korean explanation of the document or input.
- Fill meta.keywords with 3-10 Korean keywords.
- Fill meta.keyPoints with 0-10 factual bullets from the document.
- Fill meta.requirements with required materials or preconditions.
- Fill meta.unknowns with ambiguities, missing details, or year-inference notices.

## Year inference rule
Today is ${today}.
For dates without a year:
1. Assume ${currentYear}.
2. If that would be more than 6 months in the future, use ${lastYear}.
3. Record the inference in meta.unknowns.

## Output schema
Output ONLY valid JSON. No markdown. No explanation.
{
  "root": {
    "title": "string",
    "category": "string or null",
    "documentType": "안내문" | "공지문" | "준비사항" | "논설문" | "보고서" | "회의록" | "체크리스트" | "기타",
    "done": false,
    "dueDate": "YYYY-MM-DD or null",
    "children": [
      {
        "title": "string",
        "dueDate": "YYYY-MM-DD or null",
        "priority": "high" | "medium" | "low",
        "done": false,
        "children": []
      }
    ]
  },
  "meta": {
    "analysis": "string",
    "keywords": ["string"],
    "keyPoints": ["string"],
    "requirements": ["string"],
    "unknowns": ["string"]
  }
}

## Hard constraints
- Do not output ids, parentId, sortOrder, or path.
- All string values must be Korean, except priority enum values.
- If the user gave a custom category, root.category should use that exact string.
- If no custom category exists, infer a short Korean category string or use null when there is no good category.
- If the input is already atomic, root.children must be [].
- Do not output any text outside the JSON object.`;
};

export async function parseToTodoPlan(
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
): Promise<TodoPlanV2> {
  const modelToUse = options?.model || "gpt-4o-mini";
  let systemPrompt = getSystemPrompt();

  if (options?.customCategory) {
    systemPrompt += `\n\nUse "${options.customCategory}" as root.category exactly.`;
  }
  if (options?.usePriority === false) {
    systemPrompt += `\n\nSet every child priority to "medium".`;
  }
  if (options?.detailLevel === "brief") {
    systemPrompt += `\n\nKeep decomposition brief. Prefer 0-5 child todos.`;
  } else if (options?.detailLevel === "detailed") {
    systemPrompt += `\n\nDecompose as far as useful into small executable child todos.`;
  }

  const userMessage =
    content.type === "pdf"
      ? `Extract a ToDit todo plan from this PDF text:\n\n${content.text}`
      : `Extract a ToDit todo plan from this text:\n\n${content.text}`;

  const openai = getOpenAI();
  console.log(`[OpenAI] Requesting via Chat Completions (Model: ${modelToUse})`);

  let raw: string | null | undefined;
  try {
    const completion = await openai.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
      temperature: 0.2,
    });
    raw = completion.choices[0]?.message?.content;
  } catch (apiErr: any) {
    console.error("[OpenAI] API Error:", apiErr);
    throw new Error(`OpenAI 통신 중 오류가 발생했습니다: ${apiErr.message}`);
  }

  if (!raw || typeof raw !== "string") {
    throw new Error("OpenAI로부터 유효한 응답을 받지 못했습니다.");
  }

  let cleanedRaw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  const jsonMatch = cleanedRaw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedRaw = jsonMatch[0];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedRaw);
  } catch {
    console.error("[OpenAI] JSON Parse Failed. Full content:", cleanedRaw);
    throw new Error("AI 응답을 데이터로 변환하는 데 실패했습니다.");
  }

  const draft = normalizeDraftTodoPlanInput(parsed);
  if (options?.customCategory) {
    draft.root.category = options.customCategory;
  }

  return hydrateTodoTree(draft);
}
