import Link from "next/link";
import styles from "./page.module.css";

export default function RefundPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>플랜 안내</h1>
        <p className={styles.updated}>최종 업데이트: 2026년 3월 25일</p>

        <section className={styles.section}>
          <h2>1. Pro 업그레이드</h2>
          <p>
            ToDit는 Free 플랜과 Pro 플랜을 함께 운영합니다. Pro 업그레이드 시 PDF 분석, 고급 옵션,
            광고 제거 등 Pro 전용 기능이 활성화됩니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. 현재 상태</h2>
          <p>
            현재 결제 기능은 준비 중입니다. 요금제 페이지의 구매 버튼은 준비 중 안내만 제공하며 실제 결제는
            진행되지 않습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. 문의</h2>
          <p>
            플랜 또는 출시 일정 관련 문의는 아래 이메일로 접수해 주세요.
          </p>
          <p>문의: contact@aidengoldkr.dev</p>
        </section>

        <div className={styles.footer}>
          <Link href="/" className={styles.backBtn}>
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
