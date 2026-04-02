import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { REQUIRED_QUESTION_IDS } from "@/lib/survey-config";

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ submitted: false });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ submitted: false });
  }

  const { data } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  return NextResponse.json({ submitted: !!data });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const userId = session.user.id;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "서비스를 이용할 수 없습니다." }, { status: 500 });
  }

  let answers: Record<string, string>;
  try {
    const body = await request.json();
    answers = body.answers;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // Validate required questions
  for (const id of REQUIRED_QUESTION_IDS) {
    if (!answers[id] || typeof answers[id] !== "string" || answers[id].trim() === "") {
      return NextResponse.json({ error: "모든 필수 질문에 답변해 주세요." }, { status: 400 });
    }
  }

  // Check for duplicate submission
  const { data: existing } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "이미 설문에 참여하셨습니다." }, { status: 409 });
  }

  // Save survey response
  const { error: insertError } = await supabase
    .from("survey_responses")
    .insert({ user_id: userId, answers });

  if (insertError) {
    console.error("[survey] insert error:", insertError);
    return NextResponse.json({ error: "설문 저장에 실패했습니다. 다시 시도해 주세요." }, { status: 500 });
  }

  // Grant 1-year Pro plan
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const { error: upsertError } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan: "pro",
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("[survey] subscription upsert error:", upsertError);
    // Survey was saved — don't fail the user. Pro grant can be applied manually.
  }

  return NextResponse.json({ success: true });
}
