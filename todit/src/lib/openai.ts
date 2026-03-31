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

## Step 3: Hyper-Decomposition (Atomic Maximize)
- **Goal:** Break down the input into the **smallest possible executable units** (Atomic Tasks).
- **Sequence Logic:** For complex goals (e.g., 발표, 시험, 프로젝트, 행사), you MUST generate a full chain of micro-actions following this workflow:
    1. **Preparation:** 자료조사, 주제 선정, 핵심 레퍼런스 수집하기.
    2. **Drafting:** 목차(아웃라인) 구성, 초안 작성하기.
    3. **Production:** PPT 디자인, 시각 자료 삽입, 문서화 작업하기.
    4. **Refining:** 대본 작성, 오타 검토, 레이아웃 수정하기.
    5. **Verification:** 리허설 수행, 시간 체크, 피드백 반영하기.
    6. **Execution:** 최종 결과물 제출 또는 본 작업 응시하기.
- Each child todo must be specific. If a task takes more than 1-2 hours, decompose it further.
- Every child todo title must be a Korean verb phrase (~하기).
- Assign dueDate based on the root's final deadline, spreading them out realistically across multiple days leading up to the deadline.
- Assign priority: 'high' for core deliverables and final execution, 'medium' or 'low' for early preparation phases.

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
- **Maximize Decomposition:** If the input is not atomic, aim for 6-10 child todos.
- Do not output ids, parentId, sortOrder, or path.
- All string values must be Korean, except priority enum values.
- If the user gave a custom category, root.category should use that exact string.
- If no custom category exists, infer a short Korean category string or use null.
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
