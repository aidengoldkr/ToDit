import Link from "next/link";
import styles from "./page.module.css";

export default function TermsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>이용약관</h1>
        <p className={styles.updated}>최종 업데이트: 2026년 3월 25일</p>

        <section className={styles.section}>
          <h2>제1조 (목적)</h2>
          <p>
            본 약관은 ToDit(이하 "서비스")가 제공하는 AI 기반 To-Do 생성 및 관리 기능의 이용 조건과
            당사와 이용자 간의 권리, 의무, 책임사항을 규정하는 것을 목적으로 합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>제2조 (서비스 내용)</h2>
          <p>
            서비스는 이미지, PDF, 텍스트 입력을 분석하여 실행 가능한 To-Do와 행동 계획을 생성하고,
            저장·수정·관리할 수 있는 기능을 제공합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>제3조 (회원가입 및 로그인)</h2>
          <p>
            이용자는 Google 로그인 또는 이메일 회원가입을 통해 서비스를 이용할 수 있습니다. 서비스는
            계정 식별과 운영을 위해 필요한 최소한의 회원 정보를 보관합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>제4조 (플랜 안내)</h2>
          <p>
            서비스는 Free 플랜과 Pro 플랜을 제공합니다. Pro 플랜의 제공 기능과 가격은 서비스 화면 또는
            별도 안내에 따르며, 실제 구매 가능 여부는 운영 상태에 따라 달라질 수 있습니다.
          </p>
          <p>
            결제 기능이 비활성화된 기간에는 요금제 안내와 구매 대기 안내만 제공될 수 있습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>제5조 (이용자의 의무)</h2>
          <p>
            이용자는 불법 자료 업로드, 타인의 권리 침해, 서비스 운영 방해와 같은 행위를 해서는 안 되며,
            AI 생성 결과의 최종 검토와 사용 책임은 이용자에게 있습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>제6조 (면책)</h2>
          <p>
            서비스는 AI 기술의 특성상 결과의 완전성, 정확성, 적합성을 보장하지 않습니다. 서비스는 법령이
            허용하는 범위 내에서 간접적 손해에 대한 책임을 부담하지 않습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>제7조 (문의)</h2>
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
