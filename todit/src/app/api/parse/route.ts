import { NextResponse } from "next/server";
import { parseToActionPlan } from "@/lib/openai";
import { extractTextFromImages } from "@/lib/google-ocr";
import { getServerSession } from "@/lib/auth";
import {
  getOrResetUsage,
  incrementUsage,
  FREE_MONTHLY_LIMIT,
} from "@/lib/usage";
import { getTier } from "@/lib/subscription";
import { getTermsAgreed } from "@/lib/consent";
import { downloadFromParseTemp, deleteFromParseTemp } from "@/lib/supabase/storage";
import { ParseInputSchema, validateStoragePathOwnership } from "@/lib/validators";
import type { ParseInput } from "@/types";

/** PDF 최대 용량 (바이트) */
const PDF_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? "OPENAI_API_KEY is not set. Add it to .env.local." : "서비스를 일시적으로 사용할 수 없습니다." },
      { status: 503 }
    );
  }

  let session: Awaited<ReturnType<typeof getServerSession>> = null;
  if (process.env.NEXTAUTH_SECRET) {
    session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }
    const agreed = await getTermsAgreed(session.user.id);
    if (!agreed) {
      return NextResponse.json(
        { error: "이용약관 및 개인정보처리방침에 동의해 주세요." },
        { status: 403 }
      );
    }
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = ParseInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "잘못된 요청입니다." },
      { status: 400 }
    );
  }
  const { type, imageBase64, imagesBase64, imageStoragePaths, pdfBase64, pdfStoragePath, text, options } = parsed.data as ParseInput;

  const tier = session?.user?.id ? await getTier(session.user.id) : "free";

  // Free 요금제는 4o-mini 고정 및 우선순위 분석 불가 (Pro 전용 옵션 제어)
  const finalOptions = tier === "pro"
    ? options
    : { model: "gpt-4o-mini", usePriority: false };

  if (session?.user?.id) {
    const usage = await getOrResetUsage(session.user.id);
    if (tier === "free" && usage && usage.count >= FREE_MONTHLY_LIMIT) {
      return NextResponse.json(
        {
          error: `무료 플랜의 월간 생성 한도(${FREE_MONTHLY_LIMIT}회)를 모두 사용하셨습니다.`,
          code: "LIMIT_EXCEEDED",
        },
        { status: 402 }
      );
    }
  }

  const storagePathsToDelete: string[] = [];
  const userId = session?.user?.id;
  try {
    if (type === "pdf" && pdfStoragePath) {
      if (userId) validateStoragePathOwnership(pdfStoragePath, userId);
      storagePathsToDelete.push(pdfStoragePath);
    }
    if (type === "image" && Array.isArray(imageStoragePaths) && imageStoragePaths.length > 0) {
      for (const p of imageStoragePaths) {
        if (userId) validateStoragePathOwnership(p, userId);
      }
      storagePathsToDelete.push(...imageStoragePaths);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "잘못된 스토리지 경로입니다.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  let textToUse: string | undefined;
  if (type === "pdf" && pdfStoragePath) {
    try {
      const buf = await downloadFromParseTemp(pdfStoragePath);
      const m = await import("pdf-parse");
      const pdf = (m.default ?? m) as (buffer: Buffer) => Promise<{ text: string }>;
      const data = await pdf(buf);
      textToUse = data?.text ?? "";
    } catch (e) {
      await deleteFromParseTemp(storagePathsToDelete);
      const message = e instanceof Error ? e.message : "PDF download or parse failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } else if (type === "pdf" && pdfBase64) {
    try {
      const buf = Buffer.from(pdfBase64, "base64");
      const m = await import("pdf-parse");
      const pdf = (m.default ?? m) as (buffer: Buffer) => Promise<{ text: string }>;
      const data = await pdf(buf);
      textToUse = data?.text ?? "";
    } catch (e) {
      const message = e instanceof Error ? e.message : "PDF parse failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else if (type === "text" && text) {
    textToUse = text;
  } else if (type === "image" && hasImageStorage(type, imageStoragePaths)) {
    try {
      const paths = imageStoragePaths as string[];
      const buffers = await Promise.all(paths.map((p) => downloadFromParseTemp(p)));
      const base64Array = buffers.map((buf) => buf.toString("base64"));
      textToUse = await extractTextFromImages(base64Array);
    } catch (e) {
      await deleteFromParseTemp(storagePathsToDelete);
      const msg = e instanceof Error ? e.message : "";
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? msg : "서비스를 일시적으로 사용할 수 없습니다." },
        { status: 502 }
      );
    }
  } else if (type === "image") {
    const base64Array = Array.isArray(imagesBase64) && imagesBase64.length > 0
      ? imagesBase64
      : imageBase64
        ? [imageBase64]
        : [];
    try {
      textToUse = await extractTextFromImages(base64Array);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? msg : "서비스를 일시적으로 사용할 수 없습니다." },
        { status: 502 }
      );
    }
  }

  if (textToUse === undefined) {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  try {
    const plan = await parseToActionPlan(
      {
        type: type === "image" ? "text" : type,
        text: textToUse,
      },
      finalOptions
    );

    // Free 티어인 경우 결과에서 우선순위 분석 정보를 제거 (UI에서 숨김 처리)
    if (tier === "free") {
      plan.actions = plan.actions.map(action => {
        const { priority, ...rest } = action;
        return rest;
      });
    }

    let savedPlanId: string | undefined;

    if (session?.user?.id) {
      // 횟수 1 증가
      await incrementUsage(session.user.id);

      // Save to database
      const supabase = await import("@/lib/supabase/admin").then(m => m.createAdminClient());
      if (supabase) {
        const { data: savedPlan } = await supabase
          .from("saved_todo")
          .insert({
            user_id: session.user.id,
            plan: plan,
            title: plan.title || "새 To-Do 플로우",
            options: finalOptions, // Store options for history/debugging
          })
          .select("id")
          .single();
        if (savedPlan) {
          savedPlanId = savedPlan.id;
        }
      }
    }

    return NextResponse.json({ ...plan, id: savedPlanId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (storagePathsToDelete.length > 0) {
      await deleteFromParseTemp(storagePathsToDelete);
    }
  }
}

function hasImageStorage(type: string, paths: unknown): paths is string[] {
  return type === "image" && Array.isArray(paths) && paths.length > 0;
}
