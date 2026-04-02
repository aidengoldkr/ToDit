import Link from "next/link";
import styles from "./page.module.css";

export default function PlanPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>ToDit 요금제</h1>
        <p className={styles.subtitle}>
          문서를 구조화된 TODO로 바꾸는 워크플로우에 맞는 플랜을 선택하세요.
        </p>
      </header>

      <div className={styles.grid}>
        <section className={`${styles.card} ${styles.activeCard}`}>
          <div className={styles.currentBadge}>기본 플랜</div>
          <div className={styles.planHeader}>
            <h2 className={styles.planName}>Free</h2>
            <div className={styles.price}>
              무료<span>/월</span>
            </div>
            <p className={styles.planDesc}>
              텍스트와 이미지 기반으로 기본 TODO 계획을 생성합니다.
            </p>
          </div>

          <ul className={styles.features}>
            <li className={styles.feature}>
              <span className={styles.check}>✓</span>
              월 20회 TODO 생성
            </li>
            <li className={styles.feature}>
              <span className={styles.check}>✓</span>
              이미지 업로드 최대 5장
            </li>
            <li className={styles.feature}>
              <span className={styles.check}>✓</span>
              기본 AI 분석 모델 사용
            </li>
            <li className={styles.featureDisabled}>
              <span className={styles.cross}>✕</span>
              PDF 분석
            </li>
            <li className={styles.featureDisabled}>
              <span className={styles.cross}>✕</span>
              우선순위/상세 옵션
            </li>
          </ul>

          <button className={styles.planBtn} disabled>
            현재 이용 가능
          </button>
        </section>

        <section className={`${styles.card} ${styles.proCard}`}>
          <div className={styles.currentBadgePro}>🎁 한정 이벤트</div>
          <div className={styles.planHeader}>
            <h2 className={styles.planName}>Pro</h2>
            <div className={styles.price}>
              <span className={styles.priceStrike}>₩2,900</span>
              <span className={styles.priceFree}>무료</span>
              <span className={styles.pricePeriod}>/1년</span>
            </div>
            <p className={styles.surveyNote}>설문 참여 시 1년간 Pro를 무료로 드립니다.</p>
            <p className={styles.planDesc}>
              무제한 생성, PDF 분석, 고급 옵션을 포함한 확장 플랜입니다.
            </p>
          </div>

          <ul className={styles.features}>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span>
              무제한 TODO 생성
            </li>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span>
              PDF 분석 지원
            </li>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span>
              이미지 업로드 최대 50장
            </li>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span>
              우선순위/상세 설정
            </li>
            <li className={styles.feature}>
              <span className={styles.checkPro}>✓</span>
              광고 제거
            </li>
          </ul>

          <Link href="/survey" className={`${styles.planBtn} ${styles.proBtn} ${styles.surveyBtn}`}>
            설문 참여하고 1년 무료 받기 →
          </Link>
        </section>
      </div>

      <section className={styles.faq}>
        <h3 className={styles.faqTitle}>안내</h3>
        <div className={styles.faqItem}>
          <h4>플랜</h4>
          <p>현재는 Free 플랜만 바로 이용할 수 있습니다.</p>
        </div>
        <div className={styles.faqItem}>
          <h4>설문 이벤트</h4>
          <p>설문에 참여하시면 Pro 플랜 1년이 즉시 무료로 지급됩니다. 설문은 5분 이내로 완료됩니다.</p>
        </div>
        <div className={styles.faqItem}>
          <h4>결제 상태</h4>
          <p>현재 설문 이벤트 기간 중이므로 별도 결제 없이 Pro를 이용하실 수 있습니다.</p>
        </div>
      </section>
    </div>
  );
}
