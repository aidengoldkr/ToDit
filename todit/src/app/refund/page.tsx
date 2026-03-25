import Link from "next/link";
import styles from "./page.module.css";

export default function RefundPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>결제 및 환불 안내</h1>
        <p className={styles.updated}>최종 업데이트: 2026년 3월 25일</p>

        <section className={styles.section}>
          <h2>1. Pro 업그레이드</h2>
          <p>
            ToDit는 Free 플랜과 Pro 플랜을 함께 운영합니다. Pro 업그레이드 시 PDF 분석, 고급 옵션,
            광고 제거 등 Pro 전용 기능이 활성화됩니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. 결제 처리</h2>
          <p>
            결제는 서비스가 연결한 PG사 또는 결제 파트너를 통해 처리됩니다. 서비스 내부에는 결제 승인
            여부, 거래 식별 정보, 플랜 활성 상태와 같은 최소 정보만 반영됩니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. 환불 문의</h2>
          <p>
            환불 또는 결제 관련 문의는 아래 이메일로 접수해 주세요. 실제 환불 가능 여부와 처리 방식은 결제
            상태와 이용 이력, 결제 수단 정책을 함께 확인한 뒤 안내됩니다.
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
