"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useIosKakaoModal } from "@/components/IosKakaoModalProvider";
import { createStartClickHandler } from "@/lib/in-app";
import { getUpgradeHref, PRO_MONTHLY_PRICE_LABEL } from "@/lib/billing";
import type { TodoPlanV2 } from "@/types";
import styles from "./page.module.css";
import GoogleAd from "@/components/GoogleAd";

interface UserUsage {
  count: number;
  limit: number | null;
  last_reset_at: string;
}

interface SavedPlan {
  id: string;
  plan: TodoPlanV2;
  title: string;
  category: string | null;
  document_type: string | null;
  created_at: string;
}

const DOCUMENT_TYPES = [
  "all",
  "안내문",
  "공지문",
  "준비사항",
  "논설문",
  "보고서",
  "회의록",
  "체크리스트",
  "기타",
];

export default function DashboardHomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { openModal } = useIosKakaoModal();
  const handleLogin = createStartClickHandler(() => {
    signIn("google", { callbackUrl: "/dashboard" });
  }, openModal);

  const [historyPlans, setHistoryPlans] = useState<SavedPlan[]>([]);
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tempSearch, setTempSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [documentType, setDocumentType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (status === "authenticated") {
      void fetchUsage();
    }
  }, [status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(tempSearch);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [tempSearch]);

  useEffect(() => {
    if (status === "authenticated") {
      void fetchPlans();
    }
  }, [status, currentPage, category, documentType, search]);

  async function fetchUsage() {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        setUsage(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch usage:", error);
    }
  }

  async function fetchPlans() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        category,
        documentType,
        search,
      });
      const res = await fetch(`/api/plans?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setHistoryPlans(result.data);
        setTotalCount(result.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize);
  const isPro = usage?.limit === null;

  if (status === "unauthenticated") {
    return (
      <div className={styles.container}>
        <div className={styles.authPrompt}>
          <h2>로그인이 필요합니다.</h2>
          <button className={styles.authButton} onClick={() => handleLogin()}>
            Google로 계속하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.mainContent}>
        <div className={styles.dashboardContainer}>
          <aside className={styles.leftColumn}>
            <section className={styles.heroSection}>
              <h1 className={styles.heroTitle}>반갑습니다, {session?.user?.name || "사용자"}님</h1>
              <p className={styles.heroSubtitle}>
                어떤 문서를 To-Do로 만들어드릴까요?
              </p>
            </section>

            <Link href="/upload" className={styles.uploadCta}>
              새 Todo 만들기
            </Link>

            <div className={styles.quotaCard}>
              <div className={styles.quotaBody}>
                <div className={styles.planName}>{isPro ? "Pro 플랜" : "Free 플랜"}</div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: usage ? `${Math.min((usage.count / (usage.limit || 1)) * 100, 100)}%` : "0%",
                    }}
                  />
                </div>
                <div className={styles.quotaStats}>
                  <span>{usage ? usage.count : "..."} / {usage?.limit ? usage.limit : "무제한"} 생성</span>
                  <span>
                    {isPro ? "PDF 분석과 고급 옵션 활성화" : `${PRO_MONTHLY_PRICE_LABEL} · 광고 제거`}
                  </span>
                </div>
              </div>

              {!isPro && (
                <a className={styles.actionBtn} onClick={() => router.push(`/plan`)}>
                  Pro 업그레이드
                </a>
              )}
            </div>

            {!isPro && (
              <div className={styles.adCard}>
                <div className={styles.adHeader}>
                  <span className={styles.adBadge}>ADVERTISEMENT</span>
                </div>
                <div className={styles.adContent}>
                  <GoogleAd slot="1035326864" format="auto" />
                </div>
              </div>
            )}
          </aside>

          <div className={styles.rightColumn}>
            <section className={styles.historySection}>
              <div className={styles.historyHeader}>
                <h2 className={styles.sectionTitle}>저장된 Todo</h2>
                <div className={styles.searchBox}>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="제목 검색"
                    value={tempSearch}
                    onChange={(e) => setTempSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.filterBar} style={{ gap: "12px", flexWrap: "wrap" }}>
                <input
                  className={styles.searchInput}
                  style={{ maxWidth: "180px" }}
                  placeholder="카테고리"
                  value={category === "all" ? "" : category}
                  onChange={(e) => {
                    setCategory(e.target.value.trim() || "all");
                    setCurrentPage(1);
                  }}
                />
                <select
                  className={styles.searchInput}
                  style={{ maxWidth: "180px" }}
                  value={documentType}
                  onChange={(e) => {
                    setDocumentType(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type === "all" ? "문서 종류 전체" : type}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}></div>
                  <p>불러오는 중...</p>
                </div>
              ) : historyPlans.length > 0 ? (
                <>
                  <div className={styles.historyList}>
                    {historyPlans.map((plan) => {
                      const displayCategory = plan.plan.root.category || "미분류";
                      const displayDocumentType = plan.plan.root.documentType || "기타";

                      return (
                        <div
                          key={plan.id}
                          className={styles.recentCard}
                          onClick={() => router.push(`/todo?id=${plan.id}`)}
                        >
                          <div className={styles.cardHeader}>
                            <span className={styles.categoryTag}>
                              {displayCategory} · {displayDocumentType}
                            </span>
                            <p className={styles.resultTitle}>{plan.title}</p>
                          </div>
                          <div className={styles.cardFooter}>
                            <p className={styles.cardDate}>
                              {new Date(plan.created_at).toLocaleDateString()} 생성
                            </p>
                            <span className={styles.viewLink}>보기</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className={styles.pagination}>
                      <button
                        className={styles.pageBtn}
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((prev) => prev - 1)}
                      >
                        이전
                      </button>

                      <div className={styles.pageNumbers}>
                        {Array.from({ length: totalPages }, (_, index) => index + 1)
                          .slice(Math.max(currentPage - 3, 0), Math.max(currentPage + 2, 5))
                          .map((pageNumber) => (
                            <button
                              key={pageNumber}
                              className={`${styles.pageNumber} ${currentPage === pageNumber ? styles.pageNumberActive : ""}`}
                              onClick={() => setCurrentPage(pageNumber)}
                            >
                              {pageNumber}
                            </button>
                          ))}
                      </div>

                      <button
                        className={styles.pageBtn}
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((prev) => prev + 1)}
                      >
                        다음
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyCard}>
                  <h3 className={styles.emptyTitle}>저장된 Todo가 없습니다.</h3>
                  <p className={styles.emptyDesc}>
                    {search || category !== "all" || documentType !== "all"
                      ? "필터 조건에 맞는 결과가 없습니다."
                      : "첫 번째 Todo를 생성해 보세요."}
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
