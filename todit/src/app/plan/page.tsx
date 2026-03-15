"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface UserUsage {
  count: number;
  limit: number | null;
}

export default function PlanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetchUsage();
    }
  }, [status]);

  async function fetchUsage() {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const handleUpgrade = async () => {
    if (status !== "authenticated") {
      router.push("/dashboard");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/test/toggle-pro", { method: "POST" });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("업그레이드 처리 중 오류가 발생했습니다.");
      }
    } catch (e) {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const isPro = usage?.limit === null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>내게 맞는 플랜을 선택하세요</h1>
        <p className={styles.subtitle}>문서를 To-Do로 만드는 가장 스마트한 방법</p>
      </header>

      <div className={styles.grid}>
        {/* Free Plan */}
        <div className={`${styles.card} ${!isPro ? styles.activeCard : ""}`}>
          {!isPro && <div className={styles.currentBadge}>현재 플랜</div>}
          <div className={styles.planHeader}>
            <h2 className={styles.planName}>Free</h2>
            <div className={styles.price}>₩0<span>/월</span></div>
            <p className={styles.planDesc}>기본적인 To-Do 생성 기능이 필요한 분들을 위한 플랜</p>
          </div>

          <ul className={styles.features}>
            <li className={styles.feature}>
              <span className={styles.check}>✓</span> 월 5회 무료 생성
            </li>
            <li className={styles.feature}>
              <span className={styles.check}>✓</span> 기본 AI 모델 사용
            </li>
            <li className={styles.feature}>
              <span className={styles.check}>✓</span> 이미지/PDF 분석 지원
            </li>
            <li className={styles.featureDisabled}>
              <span className={styles.cross}>×</span> 광고 포함
            </li>
            <li className={styles.featureDisabled}>
              <span className={styles.cross}>×</span> 상세 분해 옵션 제외
            </li>
          </ul>

          <button
            className={styles.planBtn}
            disabled={!isPro}
            onClick={() => !isPro ? null : handleUpgrade()}
          >
            {isPro ? "Free로 전환 (테스트)" : "현재 이용 중"}
          </button>
        </div>

        {/* Pro Plan */}
        <div className={`${styles.card} ${styles.proCard} ${isPro ? styles.activeCard : ""}`}>
          {isPro && <div className={styles.currentBadgePro}>현재 플랜</div>}
          <div className={styles.planHeader}>
            <h2 className={styles.planName}>Pro</h2>
            <div className={styles.price}>₩2,900<span>/월</span></div>
            <p className={styles.planDesc}>제한 없는 최신 AI 분석과 강력한 상세 설정을 원하시는 분들을 위해</p>
          </div>

          <ul className={styles.features}>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span> <strong>무제한</strong> To-Do 생성
            </li>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span> 더 강력한 <strong>AI 분석 엔진</strong> 탑재
            </li>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span> 상세도 커스텀 (3단계)
            </li>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span> 사용자 지정 카테고리 설정
            </li>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span> 우선순위 자동 할당 기능
            </li>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span> <strong>광고 전면 제거</strong>
            </li>
          </ul>

          <button
            className={`${styles.planBtn} ${styles.proBtn}`}
            onClick={() => isPro ? handleUpgrade() : alert("PG사 입점 대기 중입니다.")}
            disabled={loading}
          >
            {loading ? "처리 중..." : (isPro ? "구독 관리 (테스트 취소)" : "Pro로 업그레이드")}
          </button>
        </div>
      </div>

      <section className={styles.faq}>
        <h3 className={styles.faqTitle}>자주 묻는 질문</h3>
        <div className={styles.faqItem}>
          <h4>Q. 언제든지 취소할 수 있나요?</h4>
          <p>네, 구독은 언제든지 취소하실 수 있으며 다음 결제일에 자동으로 종료됩니다.</p>
        </div>
        <div className={styles.faqItem}>
          <h4>Q. Free 플랜 횟수는 언제 초기화되나요?</h4>
          <p>매월 1일에 초기화됩니다.</p>
        </div>
        <div className={styles.faqItem}>
          <h4>Q. PG사 입점 대기 중인 이유?</h4>
          <p>개발자가 고등학생이라 시간이 소요되고 있습니다.</p>
        </div>
      </section>
    </div>
  );
}
