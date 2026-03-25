import { NextResponse } from "next/server";
import { parseToTodoPlan } from "@/lib/openai";
import { extractTextFromImages } from "@/lib/google-ocr";
import { getServerSession } from "@/lib/auth";
import { releaseFreeUsage, reserveFreeUsage } from "@/lib/usage";
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

function getAuthConfigErrorResponse() {
  return NextResponse.json(
    { error: "Authentication configuration is unavailable." },
    { status: 503 }
  );
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

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? "OPENAI_API_KEY is not set. Add it to .env.local."
            : "서비스를 일시적으로 사용할 수 없습니다.",
      },
      { status: 503 }
    );
  }

  let session: Awaited<ReturnType<typeof getServerSession>>;
  try {
    session = await getServerSession();
  } catch (error) {
    console.error("[parse] Failed to resolve session:", error);
    return getAuthConfigErrorResponse();
  }

  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const agreed = await getTermsAgreed(session.user.id);
    if (!agreed) {
      return NextResponse.json(
        { error: "이용약관 및 개인정보처리방침에 동의해 주세요." },
        { status: 403 }
      );
    }
  } catch (error) {
    if (error instanceof ConsentStorageError) {
      return NextResponse.json(
        { error: "동의 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 }
      );
    }
    throw error;
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ParseInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "잘못된 요청입니다." },
      { status: 400 }
    );
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

  const tier = await getTier(session.user.id);

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
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }

  const finalOptions =
    tier === "pro"
      ? { ...options, model: "gpt-4o" }
      : { model: "gpt-4o-mini", usePriority: false };

  let reservedFreeUsage = false;
  let keepReservedUsage = false;

  if (tier === "free") {
    const reservation = await reserveFreeUsage(session.user.id, session.user.name);
    if (reservation === "limit_exceeded") {
      return NextResponse.json(
        {
          error: "무료 플랜의 월간 생성 가능 횟수를 모두 사용했습니다.",
          code: "LIMIT_EXCEEDED",
        },
        { status: 402 }
      );
    }

    if (reservation === "error") {
      return NextResponse.json(
        { error: "사용량 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 }
      );
    }

    reservedFreeUsage = true;
    keepReservedUsage = true;
  }

  const storagePathsToDelete: string[] = [];
  const userId = session.user.id;

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
    keepReservedUsage = false;
    const message = error instanceof Error ? error.message : "잘못된 스토리지 경로입니다.";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  let textToUse: string | undefined;

  try {
    if (type === "pdf" && pdfStoragePath) {
      const buffer = await downloadFromParseTemp(pdfStoragePath);
      const module = await import("pdf-parse");
      const pdf = (module.default ?? module) as (
        buffer: Buffer
      ) => Promise<{ text: string }>;
      const data = await pdf(buffer);
      textToUse = data?.text ?? "";
    } else if (type === "pdf" && pdfBase64) {
      const buffer = Buffer.from(pdfBase64, "base64");
      const module = await import("pdf-parse");
      const pdf = (module.default ?? module) as (
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
  } catch (error) {
    keepReservedUsage = false;
    const message =
      error instanceof Error ? error.message : type === "pdf" ? "PDF parse failed" : "OCR failed";

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? message
            : "서비스를 일시적으로 사용할 수 없습니다.",
      },
      { status: 502 }
    );
  }

  if (textToUse === undefined) {
    keepReservedUsage = false;
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  try {
    let plan = await parseToTodoPlan(
      {
        type: type === "image" ? "text" : type,
        text: textToUse,
      },
      finalOptions
    );

    if (tier === "free") {
      plan = stripPlanPriorities(plan);
    }

    const supabase = await import("@/lib/supabase/admin").then((module) => module.createAdminClient());
    if (!supabase) {
      throw new Error("결과 저장을 위한 데이터베이스 연결이 없습니다.");
    }

    const { data: savedPlan, error } = await supabase
      .from("saved_todo")
      .insert({
        user_id: session.user.id,
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
      throw new Error(error?.message || "결과 저장에 실패했습니다.");
    }

    keepReservedUsage = true;
    return NextResponse.json({ ...plan, id: savedPlan.id });
  } catch (error) {
    keepReservedUsage = false;
    const message = error instanceof Error ? error.message : "Parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (storagePathsToDelete.length > 0) {
      await deleteFromParseTemp(storagePathsToDelete);
    }

    if (reservedFreeUsage && !keepReservedUsage) {
      await releaseFreeUsage(session.user.id);
    }
  }
}
