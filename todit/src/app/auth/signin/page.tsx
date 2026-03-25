"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, Suspense, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import styles from "../auth.module.css";

const RESEND_GENERIC_MESSAGE =
  "If a verification email can be sent, it has been sent.";

function getInitialError(errorParam: string | null) {
  if (errorParam === "CredentialsSignin") {
    return "The email or password is incorrect.";
  }
  if (errorParam === "InvalidToken") {
    return "That verification link is invalid or has already been used.";
  }
  return "";
}

function getInitialMessage(messageParam: string | null) {
  if (messageParam === "Verified") {
    return "Email verified. You can sign in now.";
  }
  if (messageParam === "AlreadyVerified") {
    return "That account is already verified.";
  }
  return "";
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const messageParam = searchParams.get("message");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(getInitialError(errorParam));
  const [message, setMessage] = useState(getInitialMessage(messageParam));
  const [isLoading, setIsLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [isResendLoading, setIsResendLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError(getInitialError(res.error) || res.error);
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  const handleResendVerification = async (e: FormEvent) => {
    e.preventDefault();
    setIsResendLoading(true);
    setResendError("");
    setResendMessage("");

    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: resendEmail }),
      });

      setResendMessage(RESEND_GENERIC_MESSAGE);
    } catch {
      setResendError("Could not send the request right now. Please try again.");
    } finally {
      setIsResendLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>로그인하고, ToDit에서 할 일을 관리해 보세요.</p>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}
        {message && <div className={styles.infoBox}>{message}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              className={styles.input}
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              className={styles.input}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className={styles.submitBtn} disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <button type="button" className={styles.googleBtn} onClick={handleGoogleSignIn}>
          <FcGoogle size={20} />
          Continue with Google
        </button>

        <div className={styles.footer}>
          계정이 없으신가요?
          <Link href="/auth/signup" className={styles.link}>
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className={styles.container}>Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}
