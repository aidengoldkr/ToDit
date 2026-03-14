import Link from "next/link";
import styles from "./page.module.css";

export default function TermsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>이용약관</h1>
        <p className={styles.updated}>최근 업데이트: 2026년 3월</p>

        <section className={styles.section}>
          <h2>제1조 (목적)</h2>
          <p>본 약관은 ToDit(이하 "서비스")가 제공하는 AI 기반 행동 플랜 생성 서비스의 이용과 관련한 사항을 규정합니다.</p>
        </section>

        <section className={styles.section}>
          <h2>제2조 (서비스 내용)</h2>
          <p>ToDit는 이미지, PDF, 텍스트 등을 AI로 분석하여 할 일 목록(To-Do) 및 행동 계획을 생성하는 기능을 제공합니다.</p>
        </section>

        <section className={styles.section}>
          <h2>제3조 (회원가입 및 로그인)</h2>
          <p>이용자는 Google OAuth 로그인을 통해 서비스에 가입합니다. 서비스는 Google로부터 제공받은 기본 프로필 정보를 계정 식별 및 서비스 제공 목적으로 사용합니다.</p>
        </section>

        <section className={styles.section}>
          <h2>제4조 (이용자의 의무)</h2>
          <p>이용자는 불법 콘텐츠 업로드, 타인의 권리 침해, 서비스 운영 방해 행위를 해서는 안 됩니다. AI 생성 결과는 이용자의 책임 하에 활용되어야 합니다.</p>
        </section>

        <section className={styles.section}>
          <h2>제5조 (면책)</h2>
          <p>서비스는 AI 기술을 활용하여 정보를 생성하므로, 결과의 정확성이나 완전성을 100% 보장하지 않습니다. 서비스 이용으로 발생한 유무형의 손해에 대해 서비스는 고의 또는 중과실이 없는 한 책임을 지지 않습니다.</p>
        </section>

        <section className={styles.section}>
          <h2>제6조 (서비스 변경 및 중단)</h2>
          <p>운영상 필요에 따라 서비스의 일부 또는 전부를 변경하거나 중단할 수 있으며, 이 경우 사전에 공지하도록 노력합니다.</p>
        </section>

        <section className={styles.section}>
          <h2>제7조 (문의 및 탈퇴)</h2>
          <p>이용자는 언제든지 계정 삭제를 요청할 수 있습니다. 관련 문의는 아래 메일로 연락해 주시기 바랍니다.</p>
          <p>문의: contact@aidengoldkr.dev</p>
        </section>

        <div className={styles.footer}>
          <Link href="/" className={styles.backBtn}>홈으로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
}
