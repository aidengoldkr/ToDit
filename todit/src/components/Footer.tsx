"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Footer.module.css";

export default function Footer() {
  const pathname = usePathname();
  const isShowFullFooter = pathname === "/" || pathname === "/dashboard";

  if (!isShowFullFooter) {
    return (
      <footer className={styles.miniFooter}>
        <p>© Aiden Development. All Rights Reserved.</p>
      </footer>
    );
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.logo}>
            To<span style={{ color: "var(--accent)" }}>Dit</span>
          </div>
          <nav className={styles.navLinks}>
            <Link href="/terms" className={styles.link}>이용약관</Link>
            <Link href="/privacy" className={styles.link}>개인정보처리방침</Link>
          </nav>
        </div>

        <div className={styles.body}>
          <div className={styles.infoRow}>
            <span>상호명 : Aiden Development</span>
            <span className={styles.divider}>|</span>
            <span>대표자 : 김건우</span>
            <span className={styles.divider}>|</span>
            <span>사업자등록번호 : 798-62-00920</span>
            <span className={styles.divider}>|</span>
            <span>주소 : 경기 남양주시 덕소로 286</span>
            <span className={styles.divider}>|</span>
            <span>Call : 031-576-0329</span>
            <span className={styles.divider}>|</span>
            <span>문의 : contact@aidengoldkr.dev</span>
          </div>
        </div>

        <div className={styles.bottom}>
          <p>© Aiden Development. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
