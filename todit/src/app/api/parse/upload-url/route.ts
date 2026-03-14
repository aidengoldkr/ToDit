import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getTermsAgreed } from "@/lib/consent";
import { createAdminClient } from "@/lib/supabase/admin";

const PARSE_TEMP_BUCKET = "parse-temp";

export async function POST(request: Request) {
  const session = await getServerSession();
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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { type, fileCount = 1 } = body;
  if (!type || !["image", "pdf"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'image' or 'pdf'" },
      { status: 400 }
    );
  }

  const count = type === "pdf" ? 1 : Math.min(Math.max(Number(fileCount) || 1, 1), 30);
  const ext = type === "pdf" ? "pdf" : "jpg";
  const userId = session.user.id;

  const uploads: { uploadUrl: string; storagePath: string }[] = [];

  for (let i = 0; i < count; i++) {
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(PARSE_TEMP_BUCKET)
      .createSignedUploadUrl(path);

    if (error) {
      console.error("[upload-url] createSignedUploadUrl failed:", error.message);
      return NextResponse.json(
        { error: "업로드 URL 생성에 실패했습니다." },
        { status: 503 }
      );
    }
    if (!data?.signedUrl || !data?.path) {
      return NextResponse.json(
        { error: "업로드 URL 생성에 실패했습니다." },
        { status: 503 }
      );
    }
    uploads.push({ uploadUrl: data.signedUrl, storagePath: data.path });
  }

  return NextResponse.json({ uploads });
}
