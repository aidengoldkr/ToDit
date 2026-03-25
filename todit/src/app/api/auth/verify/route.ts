import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/auth/signin?error=MissingToken", req.url));
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.redirect(new URL("/auth/signin?error=DbError", req.url));
    }

    const { data: user, error: findError } = await supabase
      .from("users")
      .select("id, email_verified_at")
      .eq("verification_token", token)
      .single();

    if (findError || !user) {
      return NextResponse.redirect(new URL("/auth/signin?error=InvalidToken", req.url));
    }

    if (user.email_verified_at) {
      return NextResponse.redirect(new URL("/auth/signin?message=AlreadyVerified", req.url));
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        email_verified_at: new Date().toISOString(),
        verification_token: null,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Verification update error:", updateError);
      return NextResponse.redirect(new URL("/auth/signin?error=UpdateError", req.url));
    }

    return NextResponse.redirect(new URL("/auth/signin?message=Verified", req.url));
  } catch (error) {
    console.error("Verification exception:", error);
    return NextResponse.redirect(new URL("/auth/signin?error=ServerError", req.url));
  }
}
