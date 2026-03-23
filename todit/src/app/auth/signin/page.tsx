"use client";

import { signIn } from "next-auth/react";
import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";
import { FcGoogle } from "react-icons/fc";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const messageParam = searchParams.get("message");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    errorParam === "CredentialsSignin" ? "이메일 또는 비밀번호가 올바르지 않습니다." :
      errorParam === "InvalidToken" ? "유효하지 않거나 만료된 인증 토큰입니다." : ""
  );

  const [message, setMessage] = useState(
    messageParam === "Verified" ? "이메일 인증이 완료되었습니다! 이제 로그인이 가능합니다." :
      messageParam === "AlreadyVerified" ? "이미 인증이 완료된 계정입니다." : ""
  );

  const [isLoading, setIsLoading] = useState(false);

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
      setError(res.error);
      setIsLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>다시 만나서 반가워요</h1>
          <p className={styles.subtitle}>ToDit으로 스마트하게 할 일을 관리하세요</p>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}
        {message && <div className={styles.infoBox}>{message}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>이메일</label>
            <input
              type="email"
              className={styles.input}
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>비밀번호</label>
            <input
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className={styles.submitBtn} disabled={isLoading}>
            {isLoading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className={styles.divider}>
          <span>또는</span>
        </div>

        <button type="button" className={styles.googleBtn} onClick={handleGoogleSignIn}>
          <FcGoogle size={20} />
          Google로 로그인
        </button>

        <div className={styles.footer}>
          아직 계정이 없으신가요?
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
    <Suspense fallback={<div className={styles.container}>로딩 중...</div>}>
      <SignInForm />
    </Suspense>
  );
}
