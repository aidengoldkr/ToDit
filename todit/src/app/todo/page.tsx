"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { clearStoredActionPlan, readStoredActionPlan, writeStoredActionPlan } from "@/lib/action-plan-session";
import type { ActionPlan, ActionItem } from "@/types";
import styles from "./page.module.css";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { SiGooglecalendar } from "react-icons/si";
import GoogleAd from "@/components/GoogleAd";


function TodoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const id = searchParams.get("id");

  const [result, setResult] = useState<ActionPlan | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ limit: number | null } | null>(null);
  const [sortBy, setSortBy] = useState<"none" | "date" | "priority">("none");

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [draftResult, setDraftResult] = useState<ActionPlan | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (status === "loading") return;

      if (!id) {
        // ID가 없으면 /todo 접근 불가 -> 대시보드로 이동
        router.replace("/dashboard");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/todo/${id}`);
        if (res.ok) {
          const data = await res.json();
          setResult(data);
        } else {
          // 데이터가 없거나 권한이 없는 경우
          setError("항목을 찾을 수 없거나 접근 권한이 없습니다.");
        }
      } catch (e) {
        console.error(e);
        setError("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }

      // Usage fetch
      try {
        const uRes = await fetch("/api/usage");
        if (uRes.ok) {
          const uData = await uRes.json();
          setUsage(uData);
        }
      } catch (e) {
        console.error("Usage fetch failed", e);
      }

      setHydrated(true);
    };

    loadData();
  }, [id, status, session?.user?.id]);

  const toggleAction = (index: number) => {
    if (!result || !session?.user?.id) return;
    const newActions = [...result.actions];
    newActions[index] = {
      ...newActions[index],
      done: !newActions[index].done,
    };
    const newPlan = { ...result, actions: newActions };
    setResult(newPlan);
    writeStoredActionPlan(newPlan, session.user.id);
  };

  const handleAddToCalendar = (task: string, dueDate?: string) => {
    if (!result) return;

    const eventText = `${result.title} - ${task}`;
    let dates = "";

    try {
      // 1. 날짜 추출 (YYYY-MM-DD 형식 권장이나 AI가 다른 포맷으로 줄 수 있음)
      let dateObj = new Date();
      if (dueDate) {
        const cleanDate = dueDate.replace(/[\.\/-]/g, "-"); // . 이나 / 를 - 로 정규화
        const parsed = new Date(cleanDate);
        if (!isNaN(parsed.getTime())) {
          dateObj = parsed;
        }
      }

      // 2. Google Calendar 형식 (YYYYMMDDTHHMMSSZ)
      const dateStr = dateObj.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      // 1시간 일정으로 설정
      const endObj = new Date(dateObj.getTime() + 60 * 60 * 1000);
      const endStr = endObj.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

      dates = `${dateStr}/${endStr}`;
    } catch (e) {
      console.error("Date parsing failed", e);
      // Fallback
      const now = new Date();
      const nowStr = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      dates = `${nowStr}/${nowStr}`;
    }

    const details = `ToDit에서 생성된 할 일입니다.\n원본 문서: ${result.title}\n카테고리: ${result.category}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventText)}&dates=${dates}&details=${encodeURIComponent(details)}`;

    window.open(url, "_blank");
  };

  // --- Edit Mode Handlers ---
  const handleEdit = () => {
    setDraftResult(result ? JSON.parse(JSON.stringify(result)) : null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraftResult(null);
  };

  const handleSave = () => {
    if (draftResult && session?.user?.id) {
      setResult(draftResult);
      writeStoredActionPlan(draftResult, session.user.id);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("정말 이 To-Do를 삭제하시겠습니까? 복구할 수 없습니다.")) return;

    try {
      const res = await fetch(`/api/todo/${id}`, { method: "DELETE" });
      if (res.ok) {
        alert("성공적으로 삭제되었습니다.");
        router.replace("/dashboard");
      } else {
        const data = await res.json();
        alert(data.error || "삭제에 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  // Helper for text inputs
  const handleTextChange = (field: keyof ActionPlan, value: string) => {
    if (!draftResult) return;
    setDraftResult({ ...draftResult, [field]: value });
  };

  // Helpers for string arrays (keywords, keyPoints, requirements, unknowns)
  const handleArrayChange = (field: keyof ActionPlan, index: number, value: string) => {
    if (!draftResult) return;
    const currentArray = draftResult[field] as string[];
    const newArray = [...currentArray];
    newArray[index] = value;
    setDraftResult({ ...draftResult, [field]: newArray });
  };

  const handleAddArrayItem = (field: keyof ActionPlan) => {
    if (!draftResult) return;
    const currentArray = draftResult[field] as string[] || [];
    setDraftResult({ ...draftResult, [field]: [...currentArray, ""] });
  };

  const handleRemoveArrayItem = (field: keyof ActionPlan, index: number) => {
    if (!draftResult) return;
    const currentArray = draftResult[field] as string[];
    const newArray = currentArray.filter((_, i) => i !== index);
    setDraftResult({ ...draftResult, [field]: newArray });
  };

  // Helpers for Action Items
  const handleActionChange = (index: number, field: keyof ActionItem, value: string | boolean) => {
    if (!draftResult) return;
    const newActions = [...draftResult.actions];
    newActions[index] = { ...newActions[index], [field]: value };
    setDraftResult({ ...draftResult, actions: newActions });
  };

  const handleAddAction = () => {
    if (!draftResult) return;
    const newActions = [...draftResult.actions, { task: "", priority: "medium" as "high" | "medium" | "low", due: "", done: false }];
    setDraftResult({ ...draftResult, actions: newActions });
  };

  const handleRemoveAction = (index: number) => {
    if (!draftResult) return;
    const newActions = draftResult.actions.filter((_, i) => i !== index);
    setDraftResult({ ...draftResult, actions: newActions });
  };

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>오류 발생</h2>
          <p>{error}</p>
          <button className={styles.primaryBtn} onClick={() => router.push("/dashboard")}>
            대시보드로 가기
          </button>
        </div>
      </div>
    );
  }

  if (!hydrated || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p>{loading ? "기록을 불러오는 중..." : "To-Do를 불러오는 중..."}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>To-Do가 없습니다.</h2>
          <p>먼저 대시보드에서 이미지를 업로드해, To-Do를 생성해 보세요.</p>
          <button className={styles.primaryBtn} onClick={() => router.push("/dashboard")}>
            대시보드로 가기
          </button>
        </div>
      </div>
    );
  }

  // Use draft if editing, otherwise real result
  const displayData = isEditing && draftResult ? draftResult : result;

  const {
    category = "기타",
    title = "제목 없는 To-Do 플로우",
    keywords = [],
    analysis = "요약 정보가 없습니다.",
    keyPoints = [],
    actions = [],
    requirements = [],
    unknowns = [],
  } = displayData;

  const isPro = usage?.limit === null;

  const priorityMap = { high: 3, medium: 2, low: 1 };
  const parseDate = (d?: string) => {
    if (!d) return new Date(9999, 11, 31);
    const clean = d.replace(/[\.\/-]/g, "-");
    const p = new Date(clean);
    return isNaN(p.getTime()) ? new Date(9999, 11, 31) : p;
  };

  const sortedActions = [...actions].map((action, originalIndex) => ({ ...action, originalIndex }))
    .sort((a, b) => {
      if (sortBy === "date") {
        return parseDate(a.due || undefined).getTime() - parseDate(b.due || undefined).getTime();
      }
      if (sortBy === "priority") {
        return (priorityMap[b.priority as keyof typeof priorityMap] || 0) - (priorityMap[a.priority as keyof typeof priorityMap] || 0);
      }
      return 0;
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
                  value={category}
                  onChange={(e) => handleTextChange("category", e.target.value)}
                  placeholder="카테고리"
                />
                <input
                  className={`${styles.editInput} ${styles.titleInput}`}
                  value={title}
                  onChange={(e) => handleTextChange("title", e.target.value)}
                  placeholder="제목"
                />
                <div className={styles.keywords}>
                  {keywords.map((kw, i) => (
                    <div key={i} style={{ display: "flex", gap: "4px" }}>
                      <input
                        className={styles.editInput}
                        style={{ width: "80px", padding: "4px 8px", fontSize: "12px" }}
                        value={kw}
                        onChange={(e) => handleArrayChange("keywords", i, e.target.value)}
                      />
                      <button className={styles.removeBtn} style={{ width: '24px', height: '24px' }} onClick={() => handleRemoveArrayItem("keywords", i)}>✕</button>
                    </div>
                  ))}
                  <button className={styles.addBtn} style={{ marginTop: 0, padding: "4px 8px" }} onClick={() => handleAddArrayItem("keywords")}>+ 키워드</button>
                </div>
              </>
            ) : (
              <>
                <span className={styles.categoryBadge}>{category}</span>
                <h1 className={styles.title}>{title}</h1>
                {keywords.length > 0 && (
                  <div className={styles.keywords}>
                    {keywords.map((kw, i) => (
                      <span key={i} className={styles.keyword}>#{kw}</span>
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
                  <button
                    className={`${styles.sortBtn} ${sortBy === "none" ? styles.activeSort : ""}`}
                    onClick={() => setSortBy("none")}
                  >서순</button>
                  <button
                    className={`${styles.sortBtn} ${sortBy === "date" ? styles.activeSort : ""}`}
                    onClick={() => setSortBy("date")}
                  >날짜순</button>
                  <button
                    className={`${styles.sortBtn} ${sortBy === "priority" ? styles.activeSort : ""}`}
                    onClick={() => setSortBy("priority")}
                  >우선순위</button>
                </div>
              )}
            </div>
            <div className={styles.todoList}>
              {sortedActions.length > 0 ? (
                sortedActions.map((action, sIdx) => {
                  const idx = action.originalIndex;
                  const isDone = Boolean(action.done);
                  return isEditing ? (
                    // Edit Mode Action Item
                    <div key={`edit_action_${idx}`} className={styles.todoItem} style={{ flexDirection: "column", gap: "12px" }}>
                      <div className={styles.editListItem}>
                        <input
                          className={styles.editInput}
                          value={action.task}
                          onChange={(e) => handleActionChange(idx, "task", e.target.value)}
                          placeholder="할 일 내용"
                        />
                        <button className={styles.removeBtn} onClick={() => handleRemoveAction(idx)}>✕</button>
                      </div>
                      <div className={styles.todoMeta} style={{ width: "100%", gap: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          기한:
                          <input
                            className={styles.editInput}
                            style={{ width: "120px", padding: "4px 8px" }}
                            value={action.due || ""}
                            onChange={(e) => handleActionChange(idx, "due", e.target.value)}
                            placeholder="예: 2026-03-15"
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          우선순위:
                          <select
                            className={styles.editSelect}
                            value={action.priority}
                            onChange={(e) => handleActionChange(idx, "priority", e.target.value)}
                          >
                            <option value="high">높음</option>
                            <option value="medium">보통</option>
                            <option value="low">낮음</option>
                          </select>
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px" }}>
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={(e) => handleActionChange(idx, "done", e.target.checked)}
                          />
                          완료
                        </label>
                        <button
                          className={styles.calendarBtn}
                          onClick={() => handleAddToCalendar(action.task, action.due || undefined)}
                          title="구글 캘린더에 추가"
                          type="button"
                        >
                          <SiGooglecalendar />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode Action Item
                    <label
                      key={`${action.task}-${idx}`}
                      className={`${styles.todoItem} ${isDone ? styles.done : ""}`}
                    >
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={isDone}
                        onChange={() => toggleAction(idx)}
                      />
                      <div className={styles.todoContent}>
                        <div className={styles.todoTask}>{action.task}</div>
                        <div className={styles.todoMeta}>
                          {action.due && (
                            <span className={styles.dueDate}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                              </svg>
                              {action.due}
                            </span>
                          )}
                          {action.priority && (
                            <span className={`${styles.priorityBadge} ${action.priority === 'high' ? styles.priorityHigh : action.priority === 'medium' ? styles.priorityMedium : styles.priorityLow}`}>
                              {action.priority === 'high' ? '높음' : action.priority === 'medium' ? '보통' : '낮음'}
                            </span>
                          )}
                          <button
                            className={styles.calendarBtn}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAddToCalendar(action.task, action.due || undefined);
                            }}
                            title="구글 캘린더에 추가"
                          >
                            <SiGooglecalendar />
                            <span>Google Calendar에 추가</span>
                          </button>
                        </div>
                      </div>
                    </label>
                  );
                })
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "14px" }}>To-Do List가 추출되지 않았습니다.</p>
              )}
              {isEditing && (
                <button className={styles.addBtn} onClick={handleAddAction}>+ 새로운 할 일 추가</button>
              )}
            </div>
            {!isPro && (
              <div style={{ marginTop: "40px" }}>
                <GoogleAd slot="6096081852" format="horizontal" />
              </div>
            )}
          </section>
        </main>

        {/* Right Sidebar */}
        <aside className={styles.sidebar}>
          {/* Edit Controls */}
          <div className={styles.editHeader}>
            {isEditing ? (
              <div className={styles.editButtonContainer} style={{ width: '100%', justifyContent: 'flex-end' }}>
                <button className={styles.editBtn} onClick={handleCancel}>취소</button>
                <button className={styles.saveBtn} onClick={handleSave}>저장</button>
              </div>
            ) : (
              <div className={styles.editButtonContainer} style={{ width: '100%', justifyContent: 'flex-end', gap: '8px' }}>
                <button className={styles.deleteBtn} onClick={handleDelete} title="삭제">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                  삭제
                </button>
                <button className={styles.editBtn} onClick={handleEdit}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                  수정
                </button>
              </div>
            )}
          </div>

          {/* Analysis Card */}
          <div className={styles.todoSectionTitle}>Info</div>
          <div className={styles.sideCard}>

            <div className={styles.sideCardTitle}>
              <svg className={styles.sideIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              AI 문서 요약
            </div>
            {isEditing ? (
              <textarea
                className={styles.editTextarea}
                value={analysis}
                onChange={(e) => handleTextChange("analysis", e.target.value)}
              />
            ) : (
              <div className={styles.analysisText}>{analysis}</div>
            )}
          </div>

          {/* Key Points Card */}
          {(keyPoints.length > 0 || isEditing) && (
            <div className={styles.sideCard}>
              <div className={styles.sideCardTitle}>
                <svg className={styles.sideIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                핵심 정보
              </div>
              <ul className={styles.bulletList}>
                {keyPoints.map((pt, i) => (
                  <li key={`kp_${i}`} className={styles.bulletItem}>
                    <svg className={styles.bulletIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    {isEditing ? (
                      <div className={styles.editListItem}>
                        <textarea
                          className={styles.editInput}
                          style={{ minHeight: '40px', resize: 'vertical' }}
                          value={pt}
                          onChange={(e) => handleArrayChange("keyPoints", i, e.target.value)}
                        />
                        <button className={styles.removeBtn} onClick={() => handleRemoveArrayItem("keyPoints", i)}>✕</button>
                      </div>
                    ) : (
                      pt
                    )}
                  </li>
                ))}
              </ul>
              {isEditing && (
                <button className={styles.addBtn} onClick={() => handleAddArrayItem("keyPoints")}>+ 항목 추가</button>
              )}
            </div>
          )}

          {/* Requirements Card */}
          {(requirements.length > 0 || isEditing) && (
            <div className={styles.sideCard}>
              <div className={styles.sideCardTitle}>
                <svg className={styles.sideIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                준비물 &amp; 참고
              </div>
              <ul className={styles.bulletList}>
                {requirements.map((req, i) => (
                  <li key={`req_${i}`} className={styles.bulletItem}>
                    <svg className={styles.bulletIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                    {isEditing ? (
                      <div className={styles.editListItem}>
                        <input
                          className={styles.editInput}
                          value={req}
                          onChange={(e) => handleArrayChange("requirements", i, e.target.value)}
                        />
                        <button className={styles.removeBtn} onClick={() => handleRemoveArrayItem("requirements", i)}>✕</button>
                      </div>
                    ) : (
                      req
                    )}
                  </li>
                ))}
              </ul>
              {isEditing && (
                <button className={styles.addBtn} onClick={() => handleAddArrayItem("requirements")}>+ 항목 추가</button>
              )}
            </div>
          )}

          {/* Unknowns / Warnings Card */}
          {(unknowns.length > 0 || isEditing) && (
            <div className={`${styles.sideCard} ${styles.unknownsCard}`}>
              <div className={`${styles.sideCardTitle} ${styles.unknownsTitle}`}>
                <svg className={`${styles.sideIcon} ${styles.unknownsIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                AI 추론 및 모호한 정보
              </div>
              <ul className={`${styles.bulletList} ${styles.unknownsList}`}>
                {unknowns.map((unk, i) => (
                  <li key={`unk_${i}`} className={styles.bulletItem}>
                    <svg className={styles.bulletIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01"></path>
                    </svg>
                    {isEditing ? (
                      <div className={styles.editListItem}>
                        <input
                          className={styles.editInput}
                          value={unk}
                          onChange={(e) => handleArrayChange("unknowns", i, e.target.value)}
                        />
                        <button className={styles.removeBtn} onClick={() => handleRemoveArrayItem("unknowns", i)}>✕</button>
                      </div>
                    ) : (
                      unk
                    )}
                  </li>
                ))}
              </ul>
              {isEditing && (
                <button className={styles.addBtn} onClick={() => handleAddArrayItem("unknowns")}>+ 항목 추가</button>
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
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p>로딩 중...</p>
        </div>
      </div>
    }>
      <TodoContent />
    </Suspense>
  );
}
