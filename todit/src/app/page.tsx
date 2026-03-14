"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";
import styles from "./page.module.css";
import { HiOutlineLightningBolt, HiOutlineSparkles, HiOutlineCollection } from "react-icons/hi";

export default function Home() {
  const handleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.glow} />
        <div className={styles.heroContent}>
          <div className={styles.badge}>Next-Gen Productivity AI</div>
          <h1 className={styles.title}>
            모든 문서를 <span>To-Do</span>로 <br />한 번에 변환하세요
          </h1>
          <p className={styles.subtitle}>
            안내문, 공지사항, 문제지까지. 사진 한 장이면 ToDit이 할 일을 추출하고<br />
            실행 가능한 액션 플랜을 즉시 만들어 드립니다.
          </p>
          <div className={styles.ctaGroup}>
            <button className={styles.primaryBtn} onClick={handleLogin}>
              지금 무료로 시작하기
            </button>
            <button className={styles.secondaryBtn} onClick={() => window.scrollTo({ top: 800, behavior: 'smooth' })}>
              기능 보기
            </button>
          </div>
        </div>

      </section>

      {/* Features Section */}
      <section className={styles.features} id="features">
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <HiOutlineLightningBolt />
            </div>
            <h3 className={styles.featureTitle}>초고속 OCR 파싱</h3>
            <p className={styles.featureDesc}>
              복잡한 표나 손글씨가 포함된 이미지에서도 AI가 정확하게 할 일을 식별하고 텍스트로 전환합니다.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <HiOutlineSparkles />
            </div>
            <h3 className={styles.featureTitle}>지능형 To-Do 생성</h3>
            <p className={styles.featureDesc}>
              단순히 텍스트를 옮기는 것이 아닙니다. AI가 우선순위와 기한을 분석하여 바로 실행 가능한 플랜을 제안합니다.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <HiOutlineCollection />
            </div>
            <h3 className={styles.featureTitle}>체계적인 할 일 관리</h3>
            <p className={styles.featureDesc}>
              추출된 할 일을 대시보드에서 카테고리별로 관리하고, 구글 캘린더에 연동하여 일정을 놓치지 마세요.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
