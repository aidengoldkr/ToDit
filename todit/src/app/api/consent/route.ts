import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getTermsAgreed, setTermsAgreed } from "@/lib/consent";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ agreed: false }, { status: 401 });
  }
  const agreed = await getTermsAgreed(session.user.id);
  return NextResponse.json({ agreed });
}

export async function POST() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await setTermsAgreed(session.user.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to set consent";
    return NextResponse.json({ error }, { status: 500 });
  }
}
