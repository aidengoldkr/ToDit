import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";

// 로컬은 localhost, 배포는 현재 호스트(예: todit.vercel.app) 사용
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "이메일", type: "email", placeholder: "test@example.com" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const supabase = createAdminClient();
        if (!supabase) throw new Error("데이터베이스 연결에 실패했습니다.");

        const { data: user, error } = await supabase
          .from("users")
          .select("id, email, password_hash, name, provider, email_verified_at")
          .eq("email", credentials.email)
          .single();

        if (error || !user) {
          throw new Error("가입되지 않은 이메일이거나 잘못된 비밀번호입니다.");
        }

        if (user.provider === "google") {
          throw new Error("Google 계정으로 가입된 이메일입니다. Google 로그인을 이용해주세요.");
        }

        if (!user.email_verified_at) {
          throw new Error("이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.");
        }

        if (!user.password_hash) {
          throw new Error("비밀번호가 설정되지 않은 계정입니다.");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isValid) {
          throw new Error("가입되지 않은 이메일이거나 잘못된 비밀번호입니다.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const supabase = createAdminClient();
        if (!supabase || !user.email) return true;

        // DB에 해당 이메일이 있는지 확인
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, provider")
          .eq("email", user.email)
          .single();

        if (existingUser) {
          // 자체 회원가입으로 가입한 계정인데 구글로 로그인 시도하는 경우 연동 처리
          // session 생성을 위해 user.id를 자체 DB의 UUID로 변경
          user.id = existingUser.id;
        } else {
          // 새로운 구글 로그인 사용자
          // Google 사용자도 users 테이블에 저장하여 이메일 중복 체크 등에 사용
          // id는 Google ID (token.sub)를 그대로 사용하여 기존 데이터 연동 유지
          const { error } = await supabase.from("users").insert({
            id: user.id,
            email: user.email,
            name: user.name || profile?.name,
            provider: "google",
            image: user.image,
          });

          if (error) {
            console.error("Failed to insert google user:", error.message);
          }
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // 최초 로그인 시
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin", // 커스텀 로그인 페이지 경로
    error: "/auth/signin", // 로그인 에러 발생 시 리다이렉트
  },
  secret: process.env.NEXTAUTH_SECRET,
};
