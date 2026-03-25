import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";

const GENERIC_MESSAGE =
  "If a verification email can be sent, it has been sent.";

function genericResponse() {
  return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
}

function getBaseUrl(req: Request) {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return new URL(req.url).origin;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  let email = "";

  try {
    const body = await req.json().catch(() => null);
    email = normalizeEmail(body?.email);
  } catch {
    email = "";
  }

  if (!email) {
    return genericResponse();
  }

  const supabase = createAdminClient();
  if (!supabase) {
    console.error("Resend verification: Supabase admin client unavailable");
    return genericResponse();
  }

  const { data: user, error: findError } = await supabase
    .from("users")
    .select("id, email, name, provider, email_verified_at, verification_token")
    .eq("email", email)
    .maybeSingle();

  if (findError) {
    console.error("Resend verification lookup error:", findError);
    return genericResponse();
  }

  if (!user || user.provider !== "credentials" || user.email_verified_at) {
    return genericResponse();
  }

  const oldToken = user.verification_token;
  const verificationToken = randomUUID();

  const { error: updateError } = await supabase
    .from("users")
    .update({
      verification_token: verificationToken,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("Resend verification update error:", updateError);
    return genericResponse();
  }

  try {
    const baseUrl = getBaseUrl(req);
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${verificationToken}`;

    await resend.emails.send({
      from: "ToDit <no-reply@todit.app>",
      to: email,
      subject: "[ToDit] Verify your email address",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2>ToDit email verification</h2>
          <p>Use the button below to verify your email address.</p>
          <div style="margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify email</a>
          </div>
          <p style="color: #666; font-size: 13px;">This link is valid until you use it.</p>
        </div>
      `,
    });
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);

    const { error: rollbackError } = await supabase
      .from("users")
      .update({
        verification_token: oldToken ?? null,
      })
      .eq("id", user.id);

    if (rollbackError) {
      console.error("Resend verification rollback error:", rollbackError);
    }

    return genericResponse();
  }

  return genericResponse();
}
