import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { resend } from "@/lib/resend";

const signupSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요."),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
  name: z.string().min(1, "이름을 입력해주세요."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = signupSchema.parse(body);

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { message: "데이터베이스 연결 오류" },
        { status: 500 }
      );
    }

    // 이메일 중복 확인
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, provider, email_verified_at")
      .eq("email", email)
      .single();

    if (existingUser) {
      if (existingUser.provider === "google") {
        return NextResponse.json(
          { message: "이미 Google 계정으로 등록된 이메일입니다." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "이미 가입된 이메일입니다." },
        { status: 400 }
      );
    }

    // 비밀번호 해싱
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 식별자 및 인증 토큰 생성
    const { randomUUID } = await import("crypto");
    const newId = randomUUID();
    const verificationToken = randomUUID();

    // 사용자 생성
    const { error } = await supabase.from("users").insert({
      id: newId,
      email,
      password_hash: passwordHash,
      name,
      provider: "credentials",
      verification_token: verificationToken,
      email_verified_at: null, // 명시적으로 null 설정
    });

    if (error) {
      console.error("Signup error:", error);
      return NextResponse.json(
        { message: "회원가입 처리 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    // 이메일 발송
    const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}` || "http://localhost:5173";
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${verificationToken}`;

    try {
      await resend.emails.send({
        from: "ToDit <no-reply@todit.app>", // TODO: 커스텀 도메인 설정 시 변경
        to: email,
        subject: "[ToDit] 이메일 주소를 인증해주세요",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2>ToDit에 오신 것을 환영합니다!</h2>
            <p>안녕하세요 ${name}님, ToDit 가입을 축하드립니다.</p>
            <p>아래 버튼을 클릭하여 이메일 인증을 완료하고 서비스를 시작해보세요.</p>
            <div style="margin: 30px 0;">
              <a href="${verifyUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">이메일 인증하기</a>
            </div>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px;">본 메일은 ToDit 회원가입에 따른 본인확인을 위해 발송되었습니다.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // 이메일 발송 실패해도 사용자는 생성되었으므로 일단 성공 응답을 보낼 수 있지만, 
      // 인증이 필수라면 여기서 에러 처리를 하거나 사용자에게 알림이 필요함.
    }

    return NextResponse.json(
      { message: "회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해주세요." },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as any;
      return NextResponse.json(
        { message: zodError.errors[0].message },
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
