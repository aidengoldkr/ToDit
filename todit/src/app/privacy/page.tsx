import Link from "next/link";
import styles from "../terms/page.module.css";

export default function PrivacyPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>개인정보처리방침</h1>
        <p className={styles.updated}>최종 업데이트: 2026년 3월 25일</p>

        <section className={styles.section}>
          <h2>1. 수집하는 정보</h2>
          <p>서비스는 운영에 필요한 범위에서 다음 정보를 수집하거나 처리할 수 있습니다.</p>
          <ul style={{ color: "var(--text-soft)", marginTop: "12px", lineHeight: "1.7" }}>
            <li>회원 식별 정보: 이름, 이메일, 로그인 제공자 정보</li>
            <li>업로드 자료: 이미지, PDF, 텍스트 입력 및 AI 분석 결과</li>
            <li>서비스 이용 정보: 생성 이력, 사용량, 플랜 상태</li>
            <li>결제 관련 최소 정보: 거래 식별값, 승인 결과, 결제 상태</li>
          </ul>
          <p style={{ marginTop: "12px" }}>
            카드 번호와 같은 민감한 결제 수단 정보는 PG사 또는 결제 파트너가 처리하며, 서비스가 직접 저장하지
            않습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. 개인정보 이용 목적</h2>
          <p>수집한 정보는 다음 목적 범위에서만 사용됩니다.</p>
          <ul style={{ color: "var(--text-soft)", marginTop: "12px", lineHeight: "1.7" }}>
            <li>회원 인증 및 계정 관리</li>
            <li>AI 기반 To-Do 생성과 결과 저장</li>
            <li>플랜 상태, 사용량, 결제 결과 반영</li>
            <li>보안 유지, 오류 대응, 서비스 개선</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>3. 보유 및 파기</h2>
          <p>
            회원 정보는 이용자가 서비스를 탈퇴하거나 보유 사유가 종료될 때까지 보관하며, 법령상 보존 의무가
            없는 정보는 목적 달성 후 지체 없이 삭제 또는 파기합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. 제3자 제공 및 처리 위탁</h2>
          <p>
            서비스는 이용자 동의 또는 법령상 근거 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 서비스
            제공을 위해 아래와 같은 외부 서비스를 이용할 수 있습니다.
          </p>
          <ul style={{ color: "var(--text-soft)", marginTop: "12px", lineHeight: "1.7" }}>
            <li>OpenAI: AI 분석 및 생성 처리</li>
            <li>Google Cloud Vision / PDF 처리 서비스: OCR 및 문서 분석</li>
            <li>Supabase: 데이터 저장 및 인증 처리</li>
            <li>PG사 또는 결제 파트너: 결제 승인 및 거래 처리</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>5. 이용자의 권리</h2>
          <p>
            이용자는 자신의 개인정보에 대해 조회, 정정, 삭제, 처리 정지 등을 요청할 수 있으며 관련 문의는
            아래 이메일로 접수할 수 있습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. 문의처</h2>
          <p>이메일: contact@aidengoldkr.dev</p>
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
