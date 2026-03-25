import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { normalizeStoredTodoPlan, validateTodoPlanInput } from "@/lib/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/supabase/authenticated";
import { TodoIdSchema } from "@/lib/validators";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const idResult = TodoIdSchema.safeParse(params.id);
  if (!idResult.success) {
    return NextResponse.json({ error: "유효한 ID 형식이 아닙니다." }, { status: 400 });
  }

  const supabase = getAuthenticatedClient(session.user.id);
  const { data, error } = await supabase
    .from("saved_todo")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "플랜을 찾을 수 없습니다." }, { status: 404 });
  }

  if (data.user_id !== session.user.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    return NextResponse.json(normalizeStoredTodoPlan(data.plan));
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : "저장된 할 일을 읽을 수 없습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const idResult = TodoIdSchema.safeParse(params.id);
  if (!idResult.success) {
    return NextResponse.json({ error: "유효한 ID 형식이 아닙니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "DB 연결 실패" }, { status: 500 });
  }

  const { data: item, error: checkError } = await supabase
    .from("saved_todo")
    .select("user_id")
    .eq("id", params.id)
    .single();

  if (checkError || !item) {
    return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 });
  }

  if (item.user_id !== session.user.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { error } = await supabase.from("saved_todo").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const idResult = TodoIdSchema.safeParse(params.id);
  if (!idResult.success) {
    return NextResponse.json({ error: "유효한 ID 형식이 아닙니다." }, { status: 400 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON: expected an object" }, { status: 400 });
    }

    const plan = validateTodoPlanInput((body as { plan?: unknown } | null)?.plan);
    const supabase = getAuthenticatedClient(session.user.id);
    const { error } = await supabase
      .from("saved_todo")
      .update({
        plan,
        title: plan.root.title || "제목 없는 To-Do",
        category: plan.root.category,
        document_type: plan.root.documentType,
        plan_version: 2,
      })
      .eq("id", params.id)
      .eq("user_id", session.user.id);

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json({ error: "데이터 수정에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "잘못된 요청 형식입니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
