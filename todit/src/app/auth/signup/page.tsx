"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import styles from "../auth.module.css";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "회원가입에 실패했습니다.");
      }

      setSuccessMessage(data.message || "회원가입이 완료되었습니다.");
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  if (isSuccess) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
            <h1 className={styles.title}>가입 요청을 확인했습니다</h1>
            <p className={styles.subtitle}>{successMessage}</p>
          </div>
          <Link
            href="/auth/signin"
            className={styles.submitBtn}
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>새 계정 만들기</h1>
          <p className={styles.subtitle}>신규 가입만 가능합니다. 기존 계정이 있으면 로그인 페이지를 이용해 주세요.</p>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>이름</label>
            <input
              type="text"
              className={styles.input}
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>이메일</label>
            <input
              type="email"
              className={styles.input}
              placeholder="example@todit.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>비밀번호 (6자 이상)</label>
            <input
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={isLoading}>
            {isLoading ? "처리 중..." : "회원가입"}
          </button>
        </form>

        <div className={styles.divider}>
          <span>또는</span>
        </div>

        <button type="button" className={styles.googleBtn} onClick={handleGoogleSignIn}>
          <FcGoogle size={20} />
          Google로 계속하기
        </button>

        <div className={styles.footer}>
          이미 계정이 있으신가요?{" "}
          <Link href="/auth/signin" className={styles.link}>
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
