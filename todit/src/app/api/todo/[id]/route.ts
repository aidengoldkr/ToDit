import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "DB 연결 실패" }, { status: 500 });
  }

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
