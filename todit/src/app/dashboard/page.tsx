"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useIosKakaoModal } from "@/components/IosKakaoModalProvider";
import { createStartClickHandler } from "@/lib/in-app";
import Link from "next/link";
import { readStoredActionPlan, writeStoredActionPlan } from "@/lib/action-plan-session";
import type { ActionPlan } from "@/types";
import styles from "./page.module.css";
import GoogleAd from "@/components/GoogleAd";


interface UserUsage {
  count: number;
  limit: number | null;
  last_reset_at: string;
}

interface SavedPlan {
  id: string;
  plan: ActionPlan;
  title: string;
  created_at: string;
}

export default function DashboardHomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { openModal } = useIosKakaoModal();

  const handleLogin = createStartClickHandler(() => {
    signIn("google", { callbackUrl: "/dashboard" });
  }, openModal);

  const [lastPlan, setLastPlan] = useState<SavedPlan | null>(null);
  const [historyPlans, setHistoryPlans] = useState<SavedPlan[]>([]);
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [loading, setLoading] = useState(true);

  // New states for search, filter, and pagination
  const [search, setSearch] = useState("");
  const [tempSearch, setTempSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const categories = ["all", "안내문", "공지문", "준비사항", "논설문", "보고서", "회의록", "체크리스트", "기타"];

  // Fetch Usage
  useEffect(() => {
    if (status === "authenticated") {
      fetchUsage();
    }
  }, [status]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(tempSearch);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [tempSearch]);

  // Fetch Plans when filters or page changes
  useEffect(() => {
    if (status === "authenticated") {
      fetchPlans();
    }
  }, [status, currentPage, category, search]);

  async function fetchUsage() {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (e) {
      console.error("Failed to fetch usage:", e);
    }
  }

  async function fetchPlans() {
    setLoading(true);
    try {
      const res = await fetch(`/api/plans?page=${currentPage}&category=${category}&search=${search}`);
      if (res.ok) {
        const result = await res.json();
        setHistoryPlans(result.data);
        setTotalCount(result.totalCount);
        if (result.data.length > 0 && currentPage === 1 && category === "all" && search === "") {
          setLastPlan(result.data[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch plans:", e);
    } finally {
      setLoading(false);
    }
  }

  const handlePlanClick = (id: string) => {
    router.push(`/todo?id=${id}`);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (status === "unauthenticated") {
    return (
      <div className={styles.container}>
        <div className={styles.authPrompt}>
          <h2>로그인이 필요합니다</h2>
          <button
            className={styles.authButton}
            onClick={() => handleLogin()}
          >
            Google로 계속하기
          </button>
        </div>
      </div>
    );
  }

  const isPro = usage?.limit === null;

  return (
    <div className={styles.container}>
      <main className={styles.mainContent}>
        <div className={styles.dashboardContainer}>
          {/* Left Column (30%): Action & Plan */}
          <aside className={styles.leftColumn}>
            <section className={styles.heroSection}>
              <h1 className={styles.heroTitle}>환영합니다, {session?.user?.name || '사용자'}님</h1>
              <p className={styles.heroSubtitle}>어떤 문서를 To-Do로 만들어드릴까요?</p>
            </section>

            <Link href="/upload" className={styles.uploadCta}>
              <svg className={styles.uploadIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              새로운 문서 업로드하기
            </Link>

            {/* Usage / Quota Card */}
            <div className={styles.quotaCard}>
              <div className={styles.quotaBody}>
                <div className={styles.planName}>{isPro ? "프로 요금제 (Pro)" : "무료 요금제 (Free)"}</div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: usage ? `${Math.min((usage.count / (usage.limit || 1)) * 100, 100)}%` : '0%'
                    }}
                  ></div>
                </div>
                <div className={styles.quotaStats}>
                  <span>{usage ? usage.count : "..."} / {usage?.limit ? usage.limit : "무제한"} 회 생성</span>
                  <span>{usage?.last_reset_at ? `${new Date(usage.last_reset_at).getMonth() + 1}월 사용량` : "매월 초기화"}</span>
                </div>
              </div>
              {!isPro && (
                <Link href="/plan" className={styles.actionBtn}>
                  Pro로 업그레이드
                </Link>
              )}
            </div>


            {/* Advertisement Card (Free Only) */}
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

          {/* Right Column (70%): History */}
          <div className={styles.rightColumn}>
            <section className={styles.historySection}>
              <div className={styles.historyHeader}>
                <h2 className={styles.sectionTitle}>작업 내역</h2>

                <div className={styles.searchBox}>
                  <svg className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="제목 검색..."
                    value={tempSearch}
                    onChange={(e) => setTempSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Category Filters */}
              <div className={styles.filterBar}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`${styles.filterChip} ${category === cat ? styles.filterChipActive : ""}`}
                    onClick={() => {
                      setCategory(cat);
                      setCurrentPage(1);
                    }}
                  >
                    {cat === "all" ? "전체" : cat}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}></div>
                  <p>불러오는 중...</p>
                </div>
              ) : historyPlans.length > 0 ? (
                <>
                  <div className={styles.historyList}>
                    {historyPlans.map((p) => (
                      <div
                        key={p.id}
                        className={styles.recentCard}
                        onClick={() => handlePlanClick(p.id)}
                      >
                        <div className={styles.cardHeader}>
                          <span className={styles.categoryTag}>{p.plan.category}</span>
                          <p className={styles.resultTitle}>{p.title}</p>
                        </div>
                        <div className={styles.cardFooter}>
                          <p className={styles.cardDate}>{new Date(p.created_at).toLocaleDateString()} 생성</p>
                          <span className={styles.viewLink}>보기 &rarr;</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className={styles.pagination}>
                      <button
                        className={styles.pageBtn}
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                      >
                        &larr; 이전
                      </button>

                      <div className={styles.pageNumbers}>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          // Show 5 pages around current page
                          let pageNum = currentPage;
                          if (currentPage <= 3) pageNum = i + 1;
                          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                          else pageNum = currentPage - 2 + i;

                          if (pageNum <= 0 || pageNum > totalPages) return null;

                          return (
                            <button
                              key={pageNum}
                              className={`${styles.pageNumber} ${currentPage === pageNum ? styles.pageNumberActive : ""}`}
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        className={styles.pageBtn}
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                      >
                        다음 &rarr;
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyCard}>
                  <div className={styles.emptyIllustration}>
                    <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  <h3 className={styles.emptyTitle}>기록이 없습니다.</h3>
                  <p className={styles.emptyDesc}>
                    {search || category !== "all"
                      ? "조건에 맞는 검색 결과가 없습니다."
                      : "문서를 업로드하여 첫 번째 To-Do를 만들어보세요."}
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
