import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CancelSubscriptionButton,
  SubButton,
} from "@/components/billing/subBtn";
import {
  PRO_MONTHLY_PRICE_LABEL,
  getUpgradeHref,
  isPayTestAllowedUser,
  isPayTestEnabled,
} from "@/lib/billing";
import {
  getSubscriptionByUserId,
  isSubscriptionActivePro,
} from "@/lib/billing/service";
import { getServerSession } from "@/lib/auth";
import styles from "./page.module.css";

function formatDate(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PlanPage() {
  const session = await getServerSession().catch(() => null);
  const payTestEnabled = isPayTestEnabled();

  if (payTestEnabled && !session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/plan");
  }

  if (payTestEnabled && !isPayTestAllowedUser(session?.user?.id)) {
    redirect("/dashboard");
  }

  const subscription = session?.user?.id
    ? await getSubscriptionByUserId(session.user.id).catch(() => null)
    : null;
  const isPro = isSubscriptionActivePro(subscription);
  const currentPeriodEnd = formatDate(subscription?.current_period_end);
  const nextBillingAt = formatDate(subscription?.next_billing_at);
  const isCancelScheduled = Boolean(subscription?.cancel_at_period_end);
  const impCode = process.env.NEXT_PUBLIC_PORTONE_IMP_CODE || "";
  const billingChannelKey = process.env.PORTONE_BILLING_CHANNEL_KEY || "";
  const canRenderBillingButton =
    Boolean(session?.user?.id) &&
    Boolean(impCode) &&
    Boolean(billingChannelKey);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>ToDit 요금제</h1>
        <p className={styles.subtitle}>
          문서를 구조화된 TODO로 바꾸는 워크플로우에 맞는 플랜을 선택하세요.
        </p>
      </header>

      <div className={styles.grid}>
        <section className={`${styles.card} ${!isPro ? styles.activeCard : ""}`}>
          {!isPro ? <div className={styles.currentBadge}>현재 플랜</div> : null}
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
            {isPro ? "Free 전환은 현재 구독 종료 후 반영됩니다." : "현재 이용 중"}
          </button>
        </section>

        <section
          className={`${styles.card} ${styles.proCard} ${isPro ? styles.activeCard : ""}`}
        >
          {isPro ? <div className={styles.currentBadgePro}>현재 플랜</div> : null}
          <div className={styles.planHeader}>
            <h2 className={styles.planName}>Pro</h2>
            <div className={styles.price}>
              ₩2,900<span>/월</span>
            </div>
            <p className={styles.planDesc}>
              무제한 생성, PDF 분석, 고급 옵션을 포함한 월 구독 플랜입니다.
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

          {session?.user?.id ? (
            isPro ? (
              <CancelSubscriptionButton
                className={`${styles.planBtn} ${styles.proBtn}`}
              />
            ) : canRenderBillingButton ? (
              <SubButton
                userId={session.user.id}
                impCode={impCode}
                channelKey={billingChannelKey}
                buyerEmail={session.user.email}
                className={`${styles.planBtn} ${styles.proBtn}`}
                buttonText="카드 등록 후 구독 시작"
              />
            ) : (
              <button
                className={`${styles.planBtn} ${styles.proBtn}`}
                disabled
              >
                정기결제 채널 설정이 아직 준비되지 않았습니다.
              </button>
            )
          ) : (
            <Link
              href={getUpgradeHref(false)}
              className={`${styles.planBtn} ${styles.proBtn}`}
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              로그인하고 구독하기
            </Link>
          )}
        </section>
      </div>

      <section className={styles.faq}>
        <h3 className={styles.faqTitle}>현재 구독 상태</h3>
        <div className={styles.faqItem}>
          <h4>플랜</h4>
          <p>{isPro ? `Pro (${PRO_MONTHLY_PRICE_LABEL})` : "Free"}</p>
        </div>
        <div className={styles.faqItem}>
          <h4>이용 가능 기간</h4>
          <p>
            {currentPeriodEnd
              ? `${currentPeriodEnd}까지 이용 가능합니다.`
              : "현재 활성 구독이 없습니다."}
          </p>
        </div>
        <div className={styles.faqItem}>
          <h4>다음 결제 예정일</h4>
          <p>{nextBillingAt || "예정된 자동 결제가 없습니다."}</p>
        </div>
        <div className={styles.faqItem}>
          <h4>자동 갱신 상태</h4>
          <p>
            {isCancelScheduled
              ? "현재 기간 종료 후 자동 갱신이 중단됩니다."
              : "자동 갱신이 활성화되어 있습니다."}
          </p>
        </div>
      </section>
    </div>
  );
}
