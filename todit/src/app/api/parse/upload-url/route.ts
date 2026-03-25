import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { ConsentStorageError, getTermsAgreed } from "@/lib/consent";
import { getTier } from "@/lib/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertUploadRequestAllowed,
  PlanRestrictionError,
} from "@/lib/plan-policy";

const PARSE_TEMP_BUCKET = "parse-temp";

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof getServerSession>>;
  try {
    session = await getServerSession();
  } catch (error) {
    console.error("[upload-url] Failed to resolve session:", error);
    return NextResponse.json(
      { error: "Authentication configuration is unavailable." },
      { status: 503 }
    );
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

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "서비스를 일시적으로 사용할 수 없습니다." },
      { status: 503 }
    );
  }

  let body: { type?: string; fileCount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, fileCount = 1 } = body;
  if (!type || !["image", "pdf"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'image' or 'pdf'" },
      { status: 400 }
    );
  }

  const uploadType = type as "image" | "pdf";
  const count = uploadType === "pdf" ? 1 : Math.min(Math.max(Number(fileCount) || 1, 1), 30);
  const tier = await getTier(session.user.id);

  try {
    assertUploadRequestAllowed({
      tier,
      type: uploadType,
      fileCount: count,
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

  const ext = uploadType === "pdf" ? "pdf" : "jpg";
  const uploads: { uploadUrl: string; storagePath: string }[] = [];

  for (let i = 0; i < count; i += 1) {
    const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(PARSE_TEMP_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl || !data?.path) {
      console.error("[upload-url] createSignedUploadUrl failed:", error?.message);
      return NextResponse.json(
        { error: "업로드 URL 생성에 실패했습니다." },
        { status: 503 }
      );
    }

    uploads.push({
      uploadUrl: data.signedUrl,
      storagePath: data.path,
    });
  }

  return NextResponse.json({ uploads });
}
