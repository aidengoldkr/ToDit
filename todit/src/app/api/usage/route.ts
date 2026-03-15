import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getOrResetUsage } from "@/lib/usage";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await getOrResetUsage(session.user.id, session.user.name);
  if (!usage) {
    return NextResponse.json({ error: "Could not fetch usage" }, { status: 500 });
  }

  return NextResponse.json(usage);
}
