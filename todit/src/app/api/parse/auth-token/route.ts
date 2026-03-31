import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { encode } from "next-auth/jwt";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const token = await encode({
    token: { sub: session.user.id },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: 300, // 5분
  });

  return NextResponse.json({ token });
}
