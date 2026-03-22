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

        // 1. 구글 고유 ID(user.id)로 기존 유저가 있는지 확인 (이메일이 NULL인 경우 대비)
        const { data: userById } = await supabase
          .from("users")
          .select("id, email, provider")
          .eq("id", user.id)
          .maybeSingle();

        // 2. 이메일로 기존 유저가 있는지 확인
        const { data: userByEmail } = await supabase
          .from("users")
          .select("id, email, provider")
          .eq("email", user.email)
          .maybeSingle();

        // 기존에 숫자 ID로만 존재하고 이메일이 없던 계정이라면 이메일을 채워넣어 줍니다 (데이터 연동성 확보)
        if (userById && !userById.email && user.email) {
          await supabase.from("users").update({ email: user.email }).eq("id", user.id);
        }

        // 우선순위: ID가 일치하는 계정(기본 데이터가 있을 확률이 높음) > 이메일이 일치하는 계정
        const existingUser = userById || userByEmail;

        if (existingUser) {
          // 세션 생성을 위해 user.id를 DB의 실제 ID로 변경 (기존 데이터 연동 유지)
          user.id = existingUser.id;
        } else {
          // 완전히 새로운 구글 사용자
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
      // 최초 로그인 혹은 세션 갱신 시
      if (user) {
        // 기본적으로 NextAuth에서 제공하는 ID를 사용하되, 
        // 구글 로그인 등으로 서비스 ID와 충돌이 있을 수 있으므로 DB의 실제 PK(id)로 세션 아이디를 동기화합니다.
        const supabase = createAdminClient();
        if (supabase && user.email) {
          const { data: dbUser } = await supabase
            .from("users")
            .select("id")
            .eq("email", user.email)
            .single();
          
          if (dbUser) {
            token.sub = dbUser.id; // DB의 실제 'id' 컬럼 값(UUID 또는 기존 ID)을 사용
          } else {
            token.sub = user.id;
          }
        } else {
          token.sub = user.id;
        }
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
