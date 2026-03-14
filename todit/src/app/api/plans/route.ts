import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaginationSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const params = PaginationSchema.safeParse({
    page: searchParams.get("page") || "1",
    category: searchParams.get("category") || "all",
    search: searchParams.get("search") || "",
  });
  if (!params.success) {
    return NextResponse.json({ error: "잘못된 파라미터입니다." }, { status: 400 });
  }
  const { page, category, search } = params.data;
  const pageSize = 10;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "DB Error" }, { status: 500 });
  }

  let query = supabase
    .from("saved_todo")
    .select("*", { count: "exact" })
    .eq("user_id", session.user.id);

  if (category !== "all" && category !== "") {
    query = query.eq("plan->>category", category);
  }

  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data || [],
    totalCount: count || 0,
    page,
    pageSize
  });
}
