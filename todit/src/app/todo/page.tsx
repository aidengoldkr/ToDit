"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clearStoredTodoPlan, readStoredTodoPlan, writeStoredTodoPlan } from "@/lib/action-plan-session";
import type { DocumentType, Priority, Todo, TodoPlanV2 } from "@/types";
import styles from "./page.module.css";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { SiGooglecalendar } from "react-icons/si";
import GoogleAd from "@/components/GoogleAd";

const DOCUMENT_TYPES = ["안내문", "공지문", "준비사항", "논설문", "보고서", "회의록", "체크리스트", "기타"] as const;
const PRIORITY_ORDER: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

function clonePlan(plan: TodoPlanV2): TodoPlanV2 {
  return JSON.parse(JSON.stringify(plan)) as TodoPlanV2;
}

function padSortOrder(order: number): string {
  return order.toString().padStart(4, "0");
}

function syncTodo(todo: Todo, parentId: string | null, sortOrder: number, pathPrefix?: string): Todo {
  const path = pathPrefix ? `${pathPrefix}.${padSortOrder(sortOrder)}` : padSortOrder(sortOrder);
  const children = todo.children.map((child, index) => syncTodo(child, todo.id, index + 1, path));
  return {
    ...todo,
    parentId,
    sortOrder,
    path,
    done: children.length > 0 ? children.every((child) => child.done) : todo.done,
    children,
  };
}

function syncPlan(plan: TodoPlanV2): TodoPlanV2 {
  return {
    ...plan,
    root: syncTodo(plan.root, null, 1),
  };
}

function parseDate(value?: string | null) {
  if (!value) return new Date(9999, 11, 31);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(9999, 11, 31) : parsed;
}

function TodoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const id = searchParams.get("id");
  const queryClient = useQueryClient();

  const [result, setResult] = useState<TodoPlanV2 | null>(null);
  const [draftResult, setDraftResult] = useState<TodoPlanV2 | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"none" | "date" | "priority">("none");
  const [isEditing, setIsEditing] = useState(false);

  const { data: usage = null } = useQuery<{ limit: number | null } | null>({
    queryKey: ['userUsage'],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
    enabled: status === "authenticated",
  });

  const { data: fetchedPlan, isFetching: isQueryLoading, error: queryError } = useQuery<TodoPlanV2>({
    queryKey: ['todo', id],
    queryFn: async () => {
      const res = await fetch(`/api/todo/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "할 일을 불러오지 못했습니다.");
      }
      return res.json();
    },
    enabled: status === "authenticated" && !!id,
    retry: 0,
  });

  useEffect(() => {
    if (status === "loading") return;

    if (!id) {
      const cachedPlan = readStoredTodoPlan(session?.user?.id);
      if (cachedPlan) {
        setResult(cachedPlan);
        setHydrated(true);
        return;
      }
      router.replace("/dashboard");
      return;
    }

    if (queryError) {
      setError(queryError.message);
      setLoading(false); // we override the manual loading via isQueryLoading logic later
      return;
    }

    if (fetchedPlan) {
      setResult(fetchedPlan);
      setHydrated(true);
    }
  }, [id, router, session?.user?.id, status, fetchedPlan, queryError]);

  const isLoadingData = loading || (!!id && !hydrated && isQueryLoading);

  function updateDraft(mutator: (plan: TodoPlanV2) => TodoPlanV2) {
    setDraftResult((current) => {
      if (!current) return current;
      return syncPlan(mutator(clonePlan(current)));
    });
  }

  async function persistPlan(nextPlan: TodoPlanV2, previousPlan: TodoPlanV2) {
    if (!session?.user?.id) return;

    setResult(nextPlan);
    if (!id) {
      writeStoredTodoPlan(nextPlan, session.user.id);
      return;
    }

    try {
      const res = await fetch(`/api/todo/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: nextPlan }),
      });

      if (!res.ok) {
        setResult(previousPlan);
        writeStoredTodoPlan(previousPlan, session.user.id);
        return;
      }

      writeStoredTodoPlan(nextPlan, session.user.id);
      queryClient.setQueryData(['todo', id], nextPlan);
      queryClient.invalidateQueries({ queryKey: ['historyPlans'] });
    } catch (persistError) {
      console.error("Todo update failed", persistError);
      setResult(previousPlan);
      writeStoredTodoPlan(previousPlan, session.user.id);
    }
  }

  async function toggleChild(index: number) {
    if (!result || !session?.user?.id) return;
    const previousPlan = result;
    const nextPlan = syncPlan({
      ...clonePlan(result),
      root: {
        ...clonePlan(result).root,
        children: clonePlan(result).root.children.map((child, childIndex) =>
          childIndex === index ? { ...child, done: !child.done } : child
        ),
      },
    });

    await persistPlan(nextPlan, previousPlan);
  }

  function handleAddToCalendar(task: string, dueDate?: string | null) {
    if (!result) return;

    const eventText = `${result.root.title} - ${task}`;
    const baseDate = dueDate ? new Date(`${dueDate}T09:00:00`) : new Date();
    const start = baseDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const end = new Date(baseDate.getTime() + 60 * 60 * 1000)
      .toISOString()
      .replace(/[-:]/g, "")
      .split(".")[0] + "Z";
    const details = `ToDit에서 생성한 일정입니다.\n카테고리: ${result.root.category || "미분류"}\n문서 종류: ${result.root.documentType || "기타"}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventText)}&dates=${start}/${end}&details=${encodeURIComponent(details)}`;
    window.open(url, "_blank");
  }

  function handleEdit() {
    setDraftResult(result ? clonePlan(result) : null);
    setIsEditing(true);
  }

  function handleCancel() {
    setDraftResult(null);
    setIsEditing(false);
  }

  async function handleSave() {
    if (!draftResult || !result || !session?.user?.id) {
      setIsEditing(false);
      return;
    }

    const nextPlan = syncPlan(draftResult);
    const previousPlan = result;
    setIsEditing(false);
    setLoading(true);
    try {
      await persistPlan(nextPlan, previousPlan);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm("정말 이 Todo를 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/todo/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(typeof data.error === "string" ? data.error : "삭제에 실패했습니다.");
        return;
      }

      clearStoredTodoPlan();
      router.replace("/dashboard");
    } catch (deleteError) {
      console.error(deleteError);
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  function handleRootTextChange(field: "title" | "category" | "dueDate", value: string) {
    updateDraft((plan) => ({
      ...plan,
      root: {
        ...plan.root,
        [field]: field === "category" ? value || null : field === "dueDate" ? value || null : value,
      },
    }));
  }

  function handleDocumentTypeChange(value: string) {
    updateDraft((plan) => ({
      ...plan,
      root: {
        ...plan.root,
        documentType: (value || null) as DocumentType | null,
      },
    }));
  }

  function handleMetaTextChange(field: "analysis", value: string) {
    updateDraft((plan) => ({
      ...plan,
      meta: {
        ...plan.meta,
        [field]: value,
      },
    }));
  }

  function handleMetaArrayChange(
    field: "keywords" | "keyPoints" | "requirements" | "unknowns",
    index: number,
    value: string
  ) {
    updateDraft((plan) => {
      const nextArray = [...plan.meta[field]];
      nextArray[index] = value;
      return {
        ...plan,
        meta: {
          ...plan.meta,
          [field]: nextArray,
        },
      };
    });
  }

  function handleAddMetaItem(field: "keywords" | "keyPoints" | "requirements" | "unknowns") {
    updateDraft((plan) => ({
      ...plan,
      meta: {
        ...plan.meta,
        [field]: [...plan.meta[field], ""],
      },
    }));
  }

  function handleRemoveMetaItem(field: "keywords" | "keyPoints" | "requirements" | "unknowns", index: number) {
    updateDraft((plan) => ({
      ...plan,
      meta: {
        ...plan.meta,
        [field]: plan.meta[field].filter((_, itemIndex) => itemIndex !== index),
      },
    }));
  }

  function handleChildChange(index: number, field: "title" | "dueDate" | "priority" | "done", value: string | boolean) {
    updateDraft((plan) => ({
      ...plan,
      root: {
        ...plan.root,
        children: plan.root.children.map((child, childIndex) =>
          childIndex === index
            ? {
                ...child,
                [field]:
                  field === "dueDate"
                    ? (value as string) || null
                    : value,
              }
            : child
        ),
      },
    }));
  }

  function handleAddChild() {
    updateDraft((plan) => ({
      ...plan,
      root: {
        ...plan.root,
        children: [
          ...plan.root.children,
          {
            id: crypto.randomUUID(),
            title: "",
            category: null,
            documentType: null,
            done: false,
            dueDate: null,
            priority: "medium",
            parentId: plan.root.id,
            sortOrder: plan.root.children.length + 1,
            path: "",
            children: [],
          },
        ],
      },
    }));
  }

  function handleRemoveChild(index: number) {
    updateDraft((plan) => ({
      ...plan,
      root: {
        ...plan.root,
        children: plan.root.children.filter((_, childIndex) => childIndex !== index),
      },
    }));
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>오류 발생</h2>
          <p>{error}</p>
          <button className={styles.primaryBtn} onClick={() => router.push("/dashboard")}>
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  if (!hydrated || isLoadingData) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p>{isLoadingData && loading ? "Todo를 저장하는 중..." : "Todo를 불러오는 중..."}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>Todo가 없습니다.</h2>
          <p>먼저 업로드 페이지에서 Todo를 생성해 주세요.</p>
          <button className={styles.primaryBtn} onClick={() => router.push("/dashboard")}>
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  const displayData = isEditing && draftResult ? draftResult : result;
  const root = displayData.root;
  const meta = displayData.meta;
  const isPro = usage?.limit === null;

  const sortedChildren = root.children
    .map((child, index) => ({ child, index }))
    .sort((a, b) => {
      if (sortBy === "date") {
        return parseDate(a.child.dueDate).getTime() - parseDate(b.child.dueDate).getTime();
      }
      if (sortBy === "priority") {
        return (PRIORITY_ORDER[b.child.priority ?? "medium"] ?? 0) - (PRIORITY_ORDER[a.child.priority ?? "medium"] ?? 0);
      }
      return a.index - b.index;
    });

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <main className={styles.mainContent}>
          <header className={styles.headerSection}>
            {isEditing ? (
              <>
                <input
                  className={`${styles.editInput} ${styles.categoryInput}`}
                  value={root.category || ""}
                  onChange={(e) => handleRootTextChange("category", e.target.value)}
                  placeholder="카테고리"
                />
                <input
                  className={`${styles.editInput} ${styles.titleInput}`}
                  value={root.title}
                  onChange={(e) => handleRootTextChange("title", e.target.value)}
                  placeholder="제목"
                />
                <div style={{ display: "flex", gap: "12px", marginTop: "12px", width: "100%" }}>
                  <select
                    className={styles.editSelect}
                    value={root.documentType || "기타"}
                    onChange={(e) => handleDocumentTypeChange(e.target.value)}
                  >
                    {DOCUMENT_TYPES.map((documentType) => (
                      <option key={documentType} value={documentType}>
                        {documentType}
                      </option>
                    ))}
                  </select>
                  <input
                    className={styles.editInput}
                    value={root.dueDate || ""}
                    onChange={(e) => handleRootTextChange("dueDate", e.target.value)}
                    placeholder="최종 마감일 (YYYY-MM-DD)"
                  />
                </div>
                <div className={styles.keywords}>
                  {meta.keywords.map((keyword, index) => (
                    <div key={`${keyword}-${index}`} style={{ display: "flex", gap: "4px" }}>
                      <input
                        className={styles.editInput}
                        style={{ width: "80px", padding: "4px 8px", fontSize: "12px" }}
                        value={keyword}
                        onChange={(e) => handleMetaArrayChange("keywords", index, e.target.value)}
                      />
                      <button className={styles.removeBtn} style={{ width: "24px", height: "24px" }} onClick={() => handleRemoveMetaItem("keywords", index)}>
                        ×
                      </button>
                    </div>
                  ))}
                  <button className={styles.addBtn} style={{ marginTop: 0, padding: "4px 8px" }} onClick={() => handleAddMetaItem("keywords")}>
                    + 키워드
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span className={styles.categoryBadge}>{root.category || "미분류"}</span>
                  <span className={styles.categoryBadge}>{root.documentType || "기타"}</span>
                </div>
                <h1 className={styles.title}>{root.title}</h1>
                {meta.keywords.length > 0 && (
                  <div className={styles.keywords}>
                    {meta.keywords.map((keyword, index) => (
                      <span key={`${keyword}-${index}`} className={styles.keyword}>
                        #{keyword}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </header>

          <section>
            <div className={styles.todoHeaderLayout}>
              <div className={styles.todoSectionTitle}>To-Do</div>
              {isPro && !isEditing && (
                <div className={styles.sortControls}>
                  <button className={`${styles.sortBtn} ${sortBy === "none" ? styles.activeSort : ""}`} onClick={() => setSortBy("none")}>
                    기본
                  </button>
                  <button className={`${styles.sortBtn} ${sortBy === "date" ? styles.activeSort : ""}`} onClick={() => setSortBy("date")}>
                    날짜순
                  </button>
                  <button className={`${styles.sortBtn} ${sortBy === "priority" ? styles.activeSort : ""}`} onClick={() => setSortBy("priority")}>
                    우선순위
                  </button>
                </div>
              )}
            </div>

            <div className={styles.todoList}>
              {sortedChildren.length > 0 ? (
                sortedChildren.map(({ child, index: originalIndex }) =>
                  isEditing ? (
                    <div key={child.id} className={styles.todoItem} style={{ flexDirection: "column", gap: "12px" }}>
                      <div className={styles.editListItem}>
                        <input
                          className={styles.editInput}
                          value={child.title}
                          onChange={(e) => handleChildChange(originalIndex, "title", e.target.value)}
                          placeholder="세부 할 일"
                        />
                        <button className={styles.removeBtn} onClick={() => handleRemoveChild(originalIndex)}>
                          ×
                        </button>
                      </div>
                      <div className={styles.todoMeta} style={{ width: "100%", gap: "16px" }}>
                        <input
                          className={styles.editInput}
                          style={{ width: "140px", padding: "4px 8px" }}
                          value={child.dueDate || ""}
                          onChange={(e) => handleChildChange(originalIndex, "dueDate", e.target.value)}
                          placeholder="YYYY-MM-DD"
                        />
                        <select
                          className={styles.editSelect}
                          value={child.priority ?? "medium"}
                          onChange={(e) => handleChildChange(originalIndex, "priority", e.target.value)}
                        >
                          <option value="high">높음</option>
                          <option value="medium">보통</option>
                          <option value="low">낮음</option>
                        </select>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px" }}>
                          <input
                            type="checkbox"
                            checked={child.done}
                            onChange={(e) => handleChildChange(originalIndex, "done", e.target.checked)}
                          />
                          완료
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label key={child.id} className={`${styles.todoItem} ${child.done ? styles.done : ""}`}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={child.done}
                        onChange={() => toggleChild(originalIndex)}
                      />
                      <div className={styles.todoContent}>
                        <div className={styles.todoTask}>{child.title}</div>
                        <div className={styles.todoMeta}>
                          {child.dueDate && <span className={styles.dueDate}>{child.dueDate}</span>}
                          {child.priority && (
                            <span
                              className={`${styles.priorityBadge} ${
                                child.priority === "high"
                                  ? styles.priorityHigh
                                  : child.priority === "medium"
                                    ? styles.priorityMedium
                                    : styles.priorityLow
                              }`}
                            >
                              {child.priority === "high" ? "높음" : child.priority === "medium" ? "보통" : "낮음"}
                            </span>
                          )}
                          <button
                            className={styles.calendarBtn}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleAddToCalendar(child.title, child.dueDate);
                            }}
                            title="Google Calendar에 추가"
                          >
                            <SiGooglecalendar />
                            <span>Calendar 추가</span>
                          </button>
                        </div>
                      </div>
                    </label>
                  )
                )
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "14px" }}>이 입력은 추가 분해 없이 바로 실행 가능한 Todo입니다.</p>
              )}

              {isEditing && (
                <button className={styles.addBtn} onClick={handleAddChild}>
                  + 세부 Todo 추가
                </button>
              )}
            </div>

            {!isPro && (
              <div style={{ marginTop: "40px" }}>
                <GoogleAd slot="6096081852" format="horizontal" />
              </div>
            )}
          </section>
        </main>

        <aside className={styles.sidebar}>
          <div className={styles.editHeader}>
            {isEditing ? (
              <div className={styles.editButtonContainer} style={{ width: "100%", justifyContent: "flex-end" }}>
                <button className={styles.editBtn} onClick={handleCancel}>
                  취소
                </button>
                <button className={styles.saveBtn} onClick={handleSave}>
                  저장
                </button>
              </div>
            ) : (
              <div className={styles.editButtonContainer} style={{ width: "100%", justifyContent: "flex-end", gap: "8px" }}>
                <button className={styles.deleteBtn} onClick={handleDelete}>
                  삭제
                </button>
                <button className={styles.editBtn} onClick={handleEdit}>
                  편집
                </button>
              </div>
            )}
          </div>

          <div className={styles.todoSectionTitle}>Info</div>
          <div className={styles.sideCard}>
            <div className={styles.sideCardTitle}>AI 분석</div>
            {isEditing ? (
              <textarea className={styles.editTextarea} value={meta.analysis} onChange={(e) => handleMetaTextChange("analysis", e.target.value)} />
            ) : (
              <div className={styles.analysisText}>{meta.analysis || "요약 정보가 없습니다."}</div>
            )}
          </div>

          {(meta.keyPoints.length > 0 || isEditing) && (
            <div className={styles.sideCard}>
              <div className={styles.sideCardTitle}>핵심 정보</div>
              <ul className={styles.bulletList}>
                {meta.keyPoints.map((item, index) => (
                  <li key={`key-point-${index}`} className={styles.bulletItem}>
                    {isEditing ? (
                      <div className={styles.editListItem}>
                        <textarea
                          className={styles.editInput}
                          style={{ minHeight: "40px", resize: "vertical" }}
                          value={item}
                          onChange={(e) => handleMetaArrayChange("keyPoints", index, e.target.value)}
                        />
                        <button className={styles.removeBtn} onClick={() => handleRemoveMetaItem("keyPoints", index)}>
                          ×
                        </button>
                      </div>
                    ) : (
                      item
                    )}
                  </li>
                ))}
              </ul>
              {isEditing && (
                <button className={styles.addBtn} onClick={() => handleAddMetaItem("keyPoints")}>
                  + 항목 추가
                </button>
              )}
            </div>
          )}

          {(meta.requirements.length > 0 || isEditing) && (
            <div className={styles.sideCard}>
              <div className={styles.sideCardTitle}>준비물 및 참고</div>
              <ul className={styles.bulletList}>
                {meta.requirements.map((item, index) => (
                  <li key={`requirement-${index}`} className={styles.bulletItem}>
                    {isEditing ? (
                      <div className={styles.editListItem}>
                        <input
                          className={styles.editInput}
                          value={item}
                          onChange={(e) => handleMetaArrayChange("requirements", index, e.target.value)}
                        />
                        <button className={styles.removeBtn} onClick={() => handleRemoveMetaItem("requirements", index)}>
                          ×
                        </button>
                      </div>
                    ) : (
                      item
                    )}
                  </li>
                ))}
              </ul>
              {isEditing && (
                <button className={styles.addBtn} onClick={() => handleAddMetaItem("requirements")}>
                  + 항목 추가
                </button>
              )}
            </div>
          )}

          {(meta.unknowns.length > 0 || isEditing) && (
            <div className={`${styles.sideCard} ${styles.unknownsCard}`}>
              <div className={`${styles.sideCardTitle} ${styles.unknownsTitle}`}>불확실한 정보</div>
              <ul className={`${styles.bulletList} ${styles.unknownsList}`}>
                {meta.unknowns.map((item, index) => (
                  <li key={`unknown-${index}`} className={styles.bulletItem}>
                    {isEditing ? (
                      <div className={styles.editListItem}>
                        <input
                          className={styles.editInput}
                          value={item}
                          onChange={(e) => handleMetaArrayChange("unknowns", index, e.target.value)}
                        />
                        <button className={styles.removeBtn} onClick={() => handleRemoveMetaItem("unknowns", index)}>
                          ×
                        </button>
                      </div>
                    ) : (
                      item
                    )}
                  </li>
                ))}
              </ul>
              {isEditing && (
                <button className={styles.addBtn} onClick={() => handleAddMetaItem("unknowns")}>
                  + 항목 추가
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function TodoPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.emptyState}>
            <p>로딩 중...</p>
          </div>
        </div>
      }
    >
      <TodoContent />
    </Suspense>
  );
}
