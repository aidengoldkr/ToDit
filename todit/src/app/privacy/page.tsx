import Link from "next/link";
import styles from "../terms/page.module.css";

export default function PrivacyPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>개인정보처리방침</h1>
        <p className={styles.updated}>최근 업데이트: 2026년 3월</p>

        <section className={styles.section}>
          <h2>1. 수집하는 개인정보</h2>
          <p>회사는 서비스 제공을 위해 다음 정보를 수집합니다:</p>
          <ul style={{ color: "var(--text-soft)", marginTop: "12px", lineHeight: "1.7" }}>
            <li>Google 계정 이름 및 이메일</li>
            <li>Google 고유 식별값 (로그인 식별용)</li>
            <li>업로드한 파일 (이미지, PDF) 및 AI 처리 결과</li>
          </ul>
          <p style={{ marginTop: "12px" }}>※ 비밀번호나 결제 수단 정보는 직접 수집하거나 저장하지 않습니다.</p>
        </section>

        <section className={styles.section}>
          <h2>2. 개인정보 이용 목적</h2>
          <p>수집된 정보는 다음의 목적으로만 사용됩니다:</p>
          <ul style={{ color: "var(--text-soft)", marginTop: "12px", lineHeight: "1.7" }}>
            <li>회원 식별 및 로그인 상태 유지</li>
            <li>AI 기반 To-Do 플로우 생성 및 저장 서비스 제공</li>
            <li>보안 유지 및 기술적 오류 개선</li>
          </ul>
        </section>

        <section className={sectionStyles.section}>
          <h2>3. 보유 및 파기 기간</h2>
          <p>회원 정보는 이용자가 서비스를 탈퇴할 때까지 보유하며, 탈퇴 즉시 파기됩니다. 업로드된 원본 파일은 AI 분석 처리가 완료된 후 서버에서 안전하게 삭제됩니다.</p>
        </section>

        <section className={styles.section}>
          <h2>4. 제3자 제공 및 위탁</h2>
          <p>서비스는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만, 서비스 제공을 위해 아래의 외부 인터페이스를 활용합니다:</p>
          <ul style={{ color: "var(--text-soft)", marginTop: "12px", lineHeight: "1.7" }}>
            <li>OpenAI (데이터 처리 및 AI 엔진)</li>
            <li>Google Cloud Vision / PDF Parsing Service</li>
            <li>Supabase (데이터베이스 및 인프라)</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>5. 이용자의 권리</h2>
          <p>이용자는 언제든지 자신의 정보를 조회하거나 삭제(탈퇴)를 요청할 수 있는 권리가 있습니다. 관련 요청은 고객지원 메일로 문의하시기 바랍니다.</p>
        </section>

        <section className={styles.section}>
          <h2>6. 문의처</h2>
          <p>개인정보 보호와 관련된 문의사항은 아래의 연락처로 보내주시기 바랍니다.</p>
          <p style={{ marginTop: "8px" }}>이메일: contact@aidengoldkr.dev</p>
        </section>

        <div className={styles.footer}>
          <Link href="/" className={styles.backBtn}>홈으로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
}

// 간단한 스타일 보정
const sectionStyles = {
  section: styles.section
};
