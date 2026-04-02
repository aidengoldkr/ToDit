"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SURVEY_QUESTIONS, REQUIRED_QUESTION_IDS, type SurveyQuestion } from "@/lib/survey-config";
import styles from "./page.module.css";

export default function SurveyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkLoading, setCheckLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated") {
      fetch("/api/survey")
        .then((r) => r.json())
        .then((data) => {
          if (data.submitted) setAlreadyDone(true);
        })
        .catch(() => {})
        .finally(() => setCheckLoading(false));
    } else {
      setCheckLoading(false);
    }
  }, [status]);

  const handleSelect = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    for (const id of REQUIRED_QUESTION_IDS) {
      if (!answers[id] || answers[id].trim() === "") {
        setError("모든 필수 질문에 답변해 주세요.");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const data = await res.json();

      if (res.status === 200) {
        setSubmitted(true);
      } else if (res.status === 409) {
        setAlreadyDone(true);
      } else {
        setError(data.error || "오류가 발생했습니다. 다시 시도해 주세요.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || checkLoading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className={styles.centerWrapper}>
        <div className={styles.authCard}>
          <div className={styles.authIcon}>🎁</div>
          <h2 className={styles.authTitle}>로그인하고 설문에 참여하세요</h2>
          <p className={styles.authDesc}>
            짧은 설문에 답하시면 <strong>Pro 플랜 1년</strong>을 무료로 드립니다.
          </p>
          <button
            className={styles.loginBtn}
            onClick={() => signIn("google", { callbackUrl: "/survey" })}
          >
            Google로 로그인하기
          </button>
          <button
            className={styles.loginBtnSecondary}
            onClick={() => router.push("/auth/signin?callbackUrl=/survey")}
          >
            이메일로 로그인하기
          </button>
        </div>
      </div>
    );
  }

  if (alreadyDone || submitted) {
    return (
      <div className={styles.centerWrapper}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>🎉</div>
          <h2 className={styles.successTitle}>
            {submitted ? "설문 참여 완료!" : "이미 참여하셨습니다"}
          </h2>
          <p className={styles.successDesc}>
            {submitted
              ? "감사합니다! Pro 플랜 1년이 즉시 적용되었습니다."
              : "이미 설문에 참여해 주셨습니다. Pro 플랜 혜택을 이용해 보세요."}
          </p>
          <button className={styles.dashboardBtn} onClick={() => router.push("/dashboard")}>
            대시보드로 이동하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.badge}>한정 이벤트</div>
        <h1 className={styles.title}>설문 참여하고 Pro 1년 받기</h1>
        <p className={styles.subtitle}>
          {session?.user?.name ?? "사용자"}님, 5분이면 충분합니다.
          <br />
          아래 설문에 답해주시면 <strong>Pro 플랜 1년</strong>을 바로 드립니다.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {SURVEY_QUESTIONS.map((q, index) => (
          <QuestionBlock
            key={q.id}
            question={q}
            index={index}
            value={answers[q.id] ?? ""}
            onChange={(val) => handleSelect(q.id, val)}
          />
        ))}

        {error && <p className={styles.errorMsg}>{error}</p>}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={submitting}
        >
          {submitting ? "제출 중..." : "제출하고 Pro 받기 →"}
        </button>
      </form>
    </div>
  );
}

function QuestionBlock({
  question,
  index,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  index: number;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className={styles.questionBlock}>
      <p className={styles.questionLabel}>
        <span className={styles.questionNumber}>{index + 1}</span>
        {question.label}
        {question.required && <span className={styles.required}>*</span>}
      </p>

      {question.type === "multiple_choice" ? (
        <div className={styles.optionGrid}>
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`${styles.optionBtn} ${value === opt ? styles.optionBtnSelected : ""}`}
              onClick={() => onChange(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <textarea
          className={styles.textArea}
          placeholder={question.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      )}
    </div>
  );
}
