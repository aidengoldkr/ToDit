import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
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

  const { id } = params;
  const idResult = TodoIdSchema.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json({ error: "유효한 ID 형식이 아닙니다." }, { status: 400 });
  }
  const supabase = getAuthenticatedClient(session.user.id);

  const { data, error } = await supabase
    .from("saved_todo")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "플랜을 찾을 수 없습니다." }, { status: 404 });
  }

  // 본인 것인지 확인 (RLS가 되어있겠지만 백엔드에서도 체크)
  if (data.user_id !== session.user.id) {
     return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  return NextResponse.json(data.plan);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = params;
  const idResult = TodoIdSchema.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json({ error: "유효한 ID 형식이 아닙니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "DB 연결 실패" }, { status: 500 });
  }

  // 먼저 본인 것인지 확인
  const { data: item, error: checkError } = await supabase
    .from("saved_todo")
    .select("user_id")
    .eq("id", id)
    .single();

  if (checkError || !item) {
    return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 });
  }

  if (item.user_id !== session.user.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { error } = await supabase
    .from("saved_todo")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
