import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { decode } from "next-auth/jwt";
import { parseToTodoPlan } from "@/lib/openai";
import { extractTextFromImages } from "@/lib/google-ocr";
import { checkFreeUsageLimitExceeded, reserveFreeUsage } from "@/lib/usage";
import { getTier } from "@/lib/subscription";
import { ConsentStorageError, getTermsAgreed } from "@/lib/consent";
import { downloadFromParseTemp, deleteFromParseTemp } from "@/lib/supabase/storage";
import { ParseInputSchema, validateStoragePathOwnership } from "@/lib/validators";
import {
  assertParseRequestAllowed,
  getRequestedImageCount,
  PlanRestrictionError,
} from "@/lib/plan-policy";
import type { ParseInput, Todo, TodoPlanV2 } from "@/types";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const getHeaders = (event: APIGatewayProxyEventV2) => {
  const origin = event.headers["origin"] || event.headers["Origin"] || "";
  const isAllowed = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : ALLOWED_ORIGINS[0] ?? "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
};

function jsonRes(status: number, body: unknown, event: APIGatewayProxyEventV2): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { ...getHeaders(event), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function extractUserId(event: APIGatewayProxyEventV2): Promise<string | null> {
  const authHeader = event.headers["authorization"] ?? "";
  const raw = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!raw) return null;
  const decoded = await decode({ token: raw, secret: process.env.NEXTAUTH_SECRET! });
  return (decoded?.sub as string) ?? null;
}

function stripTodoPriorities(todo: Todo): Todo {
  return {
    ...todo,
    priority: undefined,
    children: todo.children.map(stripTodoPriorities),
  };
}

function stripPlanPriorities(plan: TodoPlanV2): TodoPlanV2 {
  return {
    ...plan,
    root: stripTodoPriorities(plan.root),
  };
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const origin = event.headers["origin"] || event.headers["Origin"] || "";
  console.log(`[Lambda] ${event.requestContext.http.method} request from origin: ${origin || "unknown"}`);

  const isAllowed = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);

  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 204, headers: getHeaders(event), body: "" };
  }

  // 허용되지 않은 Origin인 경우 즉시 종료하여 불필요한 사용량 차감 방지
  if (!isAllowed) {
    console.warn(`[CORS] Rejected request from unauthorized origin: ${origin}`);
    return jsonRes(403, { 
      error: "허용되지 않은 도메인에서의 요청입니다 (CORS).",
      code: "CORS_FORBIDDEN" 
    }, event);
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonRes(503, { error: "서비스를 일시적으로 사용할 수 없습니다." }, event);
  }

  const userId = await extractUserId(event);
  if (!userId) {
    console.warn(`[Lambda] [Error] Authentication failed. No valid token found.`);
    return jsonRes(401, { error: "로그인이 필요합니다." }, event);
  }
  console.info(`[Lambda] [Step 0] User authenticated: ${userId}`);

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(event.body ?? "{}");
  } catch {
    return jsonRes(400, { error: "Invalid JSON body" }, event);
  }

  const parsed = ParseInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonRes(400, { error: parsed.error.issues[0]?.message || "잘못된 요청입니다." }, event);
  }

  const {
    type,
    imageBase64,
    imagesBase64,
    imageStoragePaths,
    pdfBase64,
    pdfStoragePath,
    text,
    options,
  } = parsed.data as ParseInput;

  // consent 와 tier 를 병렬로 조회
  let agreed: boolean;
  let tier: "free" | "pro";
  try {
    [agreed, tier] = await Promise.all([
      getTermsAgreed(userId),
      getTier(userId),
    ]);
  } catch (error) {
    if (error instanceof ConsentStorageError) {
      return jsonRes(503, { error: "동의 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요." }, event);
    }
    throw error;
  }

  if (!agreed) {
    return jsonRes(403, { error: "이용약관 및 개인정보처리방침에 동의해 주세요." }, event);
  }

  try {
    assertParseRequestAllowed({
      tier,
      type,
      imageCount: getRequestedImageCount({
        imageStoragePaths,
        imagesBase64,
        imageBase64,
      }),
    });
  } catch (error) {
    if (error instanceof PlanRestrictionError) {
      return jsonRes(error.status, { error: error.message, code: error.code }, event);
    }
    throw error;
  }

  const finalOptions =
    tier === "pro"
      ? { ...options, model: "gpt-4o" }
      : { model: "gpt-4o-mini", usePriority: false };
  console.info(`[Lambda] [Step 0] Options prepared. Tier: ${tier}, Options:`, finalOptions);

  if (tier === "free") {
    console.info(`[Lambda] [Step 1] Checking free usage limit for user: ${userId}`);
    const limitExceeded = await checkFreeUsageLimitExceeded(userId);
    if (limitExceeded === "error") {
      return jsonRes(503, { error: "사용량 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요." }, event);
    }
    if (limitExceeded) {
      return jsonRes(402, {
        error: "무료 플랜의 월간 생성 가능 횟수를 모두 사용했습니다.",
        code: "LIMIT_EXCEEDED",
      }, event);
    }
  }

  const storagePathsToDelete: string[] = [];

  try {
    if (type === "pdf" && pdfStoragePath) {
      validateStoragePathOwnership(pdfStoragePath, userId);
      storagePathsToDelete.push(pdfStoragePath);
    }

    if (type === "image" && Array.isArray(imageStoragePaths) && imageStoragePaths.length > 0) {
      for (const path of imageStoragePaths) {
        validateStoragePathOwnership(path, userId);
      }
      storagePathsToDelete.push(...imageStoragePaths);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "잘못된 스토리지 경로입니다.";
    return jsonRes(403, { error: message }, event);
  }

  let textToUse: string | undefined;

  try {
    console.info(`[Lambda] [Step 2] Processing ${type} input...`);
    if (type === "pdf" && pdfStoragePath) {
      const buffer = await downloadFromParseTemp(pdfStoragePath);
      const module = await import("pdf-parse");
      const pdf = (module.default ?? module) as unknown as (
        buffer: Buffer
      ) => Promise<{ text: string }>;
      const data = await pdf(buffer);
      textToUse = data?.text ?? "";
    } else if (type === "pdf" && pdfBase64) {
      const buffer = Buffer.from(pdfBase64, "base64");
      const module = await import("pdf-parse");
      const pdf = (module.default ?? module) as unknown as (
        buffer: Buffer
      ) => Promise<{ text: string }>;
      const data = await pdf(buffer);
      textToUse = data?.text ?? "";
    } else if (type === "text" && text) {
      textToUse = text;
    } else if (type === "image" && Array.isArray(imageStoragePaths) && imageStoragePaths.length > 0) {
      const buffers = await Promise.all(imageStoragePaths.map((path) => downloadFromParseTemp(path)));
      textToUse = await extractTextFromImages(buffers.map((buffer) => buffer.toString("base64")));
    } else if (type === "image") {
      const base64Array =
        Array.isArray(imagesBase64) && imagesBase64.length > 0
          ? imagesBase64
          : imageBase64
            ? [imageBase64]
            : [];
      textToUse = await extractTextFromImages(base64Array);
    }
    console.info(`[Lambda] [Step 2] OCR/Extraction completed. Text length: ${textToUse?.length || 0}`);
  } catch (error) {
    console.error(`[Lambda] [Error] OCR processing failed:`, error);
    if (storagePathsToDelete.length > 0) await deleteFromParseTemp(storagePathsToDelete);
    return jsonRes(502, { error: "서비스를 일시적으로 사용할 수 없습니다." }, event);
  }

  if (textToUse === undefined) {
    if (storagePathsToDelete.length > 0) await deleteFromParseTemp(storagePathsToDelete);
    return jsonRes(400, { error: "Missing content" }, event);
  }

  try {
    console.info(`[Lambda] [Step 3] Sending text to OpenAI...`);
    let plan = await parseToTodoPlan(
      {
        type: type === "image" ? "text" : type,
        text: textToUse,
      },
      finalOptions
    );
    console.info(`[Lambda] [Step 3] AI Plan generated successfully.`);

    if (tier === "free") {
      plan = stripPlanPriorities(plan);
    }

    const supabase = await import("@/lib/supabase/admin").then((module) => module.createAdminClient());
    if (!supabase) {
      throw new Error("결과 저장을 위한 데이터베이스 연결이 없습니다.");
    }

    console.info(`[Lambda] [Step 4] Saving plan to DB...`);
    const { data: savedPlan, error } = await supabase
      .from("saved_todo")
      .insert({
        user_id: userId,
        plan,
        title: plan.root.title || "제목 없는 To-Do",
        category: plan.root.category,
        document_type: plan.root.documentType,
        plan_version: 2,
        options: finalOptions,
      })
      .select("id")
      .single();

    if (error || !savedPlan?.id) {
      console.error(`[Lambda] [Error] DB insert failed:`, error);
      throw new Error(error?.message || "결과 저장에 실패했습니다.");
    }
    console.info(`[Lambda] [Step 4] Saved to DB with ID: ${savedPlan.id}`);

    // 저장 성공 후에만 사용량 증가 (오류 시 차감 없음)
    if (tier === "free") {
      console.info(`[Lambda] [Step 5] Incrementing usage for free user: ${userId}`);
      await reserveFreeUsage(userId);
      console.info(`[Lambda] [Step 5] Usage incremented.`);
    }

    return jsonRes(200, { ...plan, id: savedPlan.id }, event);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parse failed";
    return jsonRes(500, { error: message }, event);
  } finally {
    if (storagePathsToDelete.length > 0) {
      await deleteFromParseTemp(storagePathsToDelete);
    }
  }
};
