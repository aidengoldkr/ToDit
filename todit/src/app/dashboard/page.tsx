"use client";

import React, { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useIosKakaoModal } from "@/components/IosKakaoModalProvider";
import { createStartClickHandler } from "@/lib/in-app";
import type { Todo, TodoPlanV2 } from "@/types";
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

function countTodos(todo: Todo): { total: number; done: number } {
  if (todo.children.length === 0) {
    return { total: 1, done: todo.done ? 1 : 0 };
  }
  return todo.children.reduce(
    (acc, child) => {
      const c = countTodos(child);
      return { total: acc.total + c.total, done: acc.done + c.done };
    },
    { total: 0, done: 0 }
  );
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
const PRO_PLAN_PRICE_LABEL = "₩2,900 / 월";

export default function DashboardHomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { openModal } = useIosKakaoModal();

  const handleLogin = createStartClickHandler(() => {
    signIn("google", { callbackUrl: "/dashboard" });
  }, openModal);

  const [search, setSearch] = useState("");
  const [tempSearch, setTempSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [documentType, setDocumentType] = useState("all");
  const [sortType, setSortType] = useState<"date" | "progress">("date");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: usage = null } = useQuery<UserUsage | null>({
    queryKey: ['userUsage'],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
    enabled: status === "authenticated",
  });

  const { data: plansData, isFetching: isFetchingPlans } = useQuery({
    queryKey: ['historyPlans', currentPage, category, documentType, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(currentPage),
        category,
        documentType,
        search,
      });
      const res = await fetch(`/api/plans?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json() as Promise<{ data: SavedPlan[], totalCount: number }>;
    },
    enabled: status === "authenticated",
    placeholderData: keepPreviousData,
  });

  const historyPlans = plansData?.data || [];
  const totalCount = plansData?.totalCount || 0;
  const loading = status === "loading" || (isFetchingPlans && !plansData);

  const sortedPlans = [...historyPlans].sort((a, b) => {
    if (sortType === "progress") {
      const aCounts = countTodos(a.plan.root);
      const bCounts = countTodos(b.plan.root);
      const aProgress = aCounts.total > 0 ? aCounts.done / aCounts.total : 0;
      const bProgress = bCounts.total > 0 ? bCounts.done / bCounts.total : 0;
      return bProgress - aProgress;
    }
    return 0; // Default is "date", already sorted descending by API
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(tempSearch);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [tempSearch]);

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
                    {isPro ? "PDF 분석과 고급 옵션 활성화" : `${PRO_PLAN_PRICE_LABEL} · 광고 제거`}
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

              <div className={styles.filterBar} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", width: "100%" }}>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", flex: "1 1 auto" }}>
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
                <div className={styles.sortControls}>
                  <button
                    className={`${styles.sortBtn} ${sortType === "date" ? styles.activeSort : ""}`}
                    onClick={() => setSortType("date")}
                  >
                    최신순
                  </button>
                  <button
                    className={`${styles.sortBtn} ${sortType === "progress" ? styles.activeSort : ""}`}
                    onClick={() => setSortType("progress")}
                  >
                    진행도순
                  </button>
                </div>
              </div>

              {loading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}></div>
                  <p>불러오는 중...</p>
                </div>
              ) : sortedPlans.length > 0 ? (
                <>
                  <div className={styles.historyList}>
                    {sortedPlans.map((plan) => {
                      const displayCategory = plan.plan.root.category || "미분류";
                      const displayDocumentType = plan.plan.root.documentType || "기타";
                      const { total, done } = countTodos(plan.plan.root);
                      const isAllDone = total > 0 && done === total;

                      return (
                        <div
                          key={plan.id}
                          className={`${styles.recentCard} ${isAllDone ? styles.recentCardDone : ""}`}
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
                            <div className={styles.cardFooterRight}>
                              {total > 0 && (
                                <span
                                  className={`${styles.progressBadge} ${isAllDone ? styles.progressBadgeDone : ""}`}
                                >
                                  {done}/{total}
                                </span>
                              )}
                              <span className={styles.viewLink}>보기</span>
                            </div>
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
