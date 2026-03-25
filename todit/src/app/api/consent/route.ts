import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { ConsentStorageError, getTermsAgreed, setTermsAgreed } from "@/lib/consent";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ agreed: false }, { status: 401 });
  }
  try {
    const agreed = await getTermsAgreed(session.user.id);
    return NextResponse.json({ agreed });
  } catch (error) {
    const message =
      error instanceof ConsentStorageError
        ? "Consent storage is unavailable."
        : "Failed to load consent.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await setTermsAgreed(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof ConsentStorageError
        ? "Consent storage is unavailable."
        : error instanceof Error
          ? error.message
          : "Failed to set consent";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
