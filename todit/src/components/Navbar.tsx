"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { clearStoredActionPlan } from "@/lib/action-plan-session";
import styles from "./Navbar.module.css";
import { TiAdjustContrast } from "react-icons/ti";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [isDark, setIsDark] = useState(false);

  const handleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  useEffect(() => {
    // Check initial dark mode state
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.leftSection}>
        <Link href={status === "authenticated" ? "/dashboard" : "/"} className={styles.logo}>
          To<span style={{ color: "var(--accent)" }}>Dit</span>
        </Link>
      </div>

      <div className={styles.rightSection}>
        {status === "authenticated" && session ? (
          <div className={styles.account}>
            <div className={styles.avatar}>
              {session.user?.image ? (
                <img src={session.user.image} alt={session.user.name || "User"} />
              ) : (
                <span>{session.user?.name?.[0] || "U"}</span>
              )}
            </div>
            <span className={styles.userName}>{session.user?.name}</span>
            <button
              type="button"
              onClick={() => {
                clearStoredActionPlan();
                signOut({ callbackUrl: "/" });
              }}
              className={styles.btn}
              style={{ background: 'var(--surface-soft)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button 
            type="button" 
            onClick={handleLogin} 
            className={styles.btn}
            disabled={status === "loading"}
          >
            {status === "loading" ? "..." : "로그인"}
          </button>
        )}

        <button onClick={toggleTheme} className={styles.themeToggle} aria-label="Toggle theme">
          <TiAdjustContrast />
        </button>
      </div>
    </nav>
  );
}
