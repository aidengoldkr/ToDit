import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { resend } from "@/lib/resend";

const signupSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해 주세요."),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
  name: z.string().min(1, "이름을 입력해 주세요."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = signupSchema.parse(body);

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ message: "데이터베이스 연결 오류" }, { status: 500 });
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id, provider, email, email_verified_at")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.provider === "google") {
        return NextResponse.json(
          { message: "이미 Google 계정으로 가입된 이메일입니다. Google 로그인을 이용해 주세요." },
          { status: 400 }
        );
      }

      if (existingUser.provider === "credentials" && !existingUser.email_verified_at) {
        return NextResponse.json(
          {
            message:
              "이미 가입된 계정입니다. 계정 정보는 변경되지 않았습니다. 로그인 페이지의 인증 메일 재전송 기능을 이용해 주세요.",
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { message: "이미 가입된 이메일입니다." },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { randomUUID } = await import("crypto");
    const newId = randomUUID();
    const verificationToken = randomUUID();

    const { error } = await supabase.from("users").insert({
      id: newId,
      email,
      password_hash: passwordHash,
      name,
      provider: "credentials",
      verification_token: verificationToken,
      email_verified_at: null,
    });

    if (error) {
      console.error("Signup error:", error);
      return NextResponse.json(
        { message: "회원가입 처리 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${verificationToken}`;

    try {
      await resend.emails.send({
        from: "ToDit <no-reply@todit.app>",
        to: email,
        subject: "[ToDit] 이메일 주소를 인증해 주세요",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2>ToDit 이메일 인증 안내</h2>
            <p>아래 버튼을 눌러 이메일 인증을 완료해 주세요.</p>
            <div style="margin: 30px 0;">
              <a href="${verifyUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">이메일 인증하기</a>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);

      await supabase.from("users").delete().eq("id", newId);

      return NextResponse.json(
        { message: "인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { message: "회원가입이 완료되었습니다. 이메일을 확인해 인증을 완료해 주세요." },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message || "잘못된 입력입니다." },
        { status: 400 }
      );
    }

    console.error("Signup exception:", error);
    return NextResponse.json(
      { message: "잘못된 요청이거나 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
