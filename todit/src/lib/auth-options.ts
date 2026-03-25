import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";

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
        email: { label: "Email", type: "email", placeholder: "test@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const supabase = createAdminClient();
        if (!supabase) {
          throw new Error("Database connection is unavailable.");
        }

        const { data: user, error } = await supabase
          .from("users")
          .select("id, email, password_hash, name, provider, email_verified_at")
          .eq("email", credentials.email)
          .single();

        if (error || !user) {
          throw new Error("The email or password is incorrect.");
        }

        if (user.provider === "google") {
          throw new Error("This account uses Google sign-in.");
        }

        if (!user.email_verified_at) {
          throw new Error("Please verify your email before signing in.");
        }

        if (!user.password_hash) {
          throw new Error("Password is not configured for this account.");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isValid) {
          throw new Error("The email or password is incorrect.");
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
      if (account?.provider !== "google") {
        return true;
      }

      const supabase = createAdminClient();
      if (!supabase || !user.email) {
        return true;
      }

      const { data: userById } = await supabase
        .from("users")
        .select("id, email, provider")
        .eq("id", user.id)
        .maybeSingle();

      const { data: userByEmail } = await supabase
        .from("users")
        .select("id, email, provider")
        .eq("email", user.email)
        .maybeSingle();

      if (userById && !userById.email && user.email) {
        await supabase.from("users").update({ email: user.email }).eq("id", user.id);
      }

      const existingUser = userById || userByEmail;
      if (existingUser) {
        user.id = existingUser.id;
        return true;
      }

      const { error } = await supabase.from("users").insert({
        id: user.id,
        email: user.email,
        name: user.name || profile?.name,
        provider: "google",
        image: user.image,
      });

      if (error) {
        console.error("Failed to insert google user:", error.message);

        const { data: fallbackUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();

        if (fallbackUser?.id) {
          user.id = fallbackUser.id;
          return true;
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const supabase = createAdminClient();
        if (supabase && user.email) {
          const { data: dbUser } = await supabase
            .from("users")
            .select("id")
            .eq("email", user.email)
            .maybeSingle();

          token.sub = dbUser?.id ?? user.id;
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
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
