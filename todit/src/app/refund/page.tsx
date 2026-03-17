import Link from "next/link";
import styles from "./page.module.css";

export default function RefundPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>환불 방침</h1>
        <p className={styles.updated}>최근 업데이트: 2026년 3월</p>

        <section className={styles.section}>
          <h2>1. 결제 및 구독 (Subscription)</h2>
          <p>Todit의 모든 유료 플랜은 선불 정기 결제 방식입니다.</p>
          <p>결제 시점부터 한 달간 서비스의 모든 유료 기능을 제한 없이 이용할 수 있습니다.</p>
        </section>

        <section className={styles.section}>
          <h2>2. 환불 불가 원칙 (No-Refund Policy)</h2>
          <p><strong>디지털 콘텐츠 특성:</strong> 서비스 결제 즉시 유료 기능(문서 변환, 워크플로우 생성 등)이 활성화되는 디지털 서비스의 특성상, 단순 변심에 의한 중도 환불은 불가능합니다.</p>
          <p><strong>이용 기록 존재 시:</strong> 결제 후 서비스를 1회라도 이용(데이터 생성, API 호출 등)한 경우, 어떠한 경우에도 해당 월의 결제 대금은 환불되지 않습니다.</p>
        </section>

        <section className={styles.section}>
          <h2>3. 예외적 전액 환불 (법정 기준)</h2>
          <p><strong>결제 후 7일 이내:</strong> 결제 후 7일 이내이며, 서비스 이용 기록(문서 업로드, 플로우 생성 등)이 전혀 없는 경우에 한하여 전액 환불이 가능합니다.</p>
          <p>환불 신청은 <strong>contact@aidengoldkr.dev</strong>를 통해 접수해 주시기 바랍니다.</p>
        </section>

        <section className={styles.section}>
          <h2>4. 구독 해지 (Cancellation)</h2>
          <p>사용자는 언제든지 구독을 해지할 수 있습니다.</p>
          <p><strong>해지 시점의 혜택:</strong> 구독을 해지하더라도 이미 결제된 남은 이용 기간까지는 유료 기능을 계속 사용할 수 있습니다.</p>
          <p><strong>차기 결제 중단:</strong> 해지 시점 이후, 다음 결제 예정일부터는 추가 과금이 발생하지 않습니다.</p>
        </section>

        <div className={styles.footer}>
          <Link href="/" className={styles.backBtn}>홈으로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
}
