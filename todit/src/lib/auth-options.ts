import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
  ],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/upload",
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Vercel 등에서는 NEXTAUTH_URL을 환경 변수로 설정하면 됨
};
