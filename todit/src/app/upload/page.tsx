"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useIosKakaoModal } from "@/components/IosKakaoModalProvider";
import { createStartClickHandler } from "@/lib/in-app";

import {
  readStoredTodoPlan,
  writeStoredTodoPlan,
  clearStoredTodoPlan,
} from "@/lib/action-plan-session";
import { getUpgradeHref, PRO_MONTHLY_PRICE_LABEL } from "@/lib/billing";
import { FREE_IMAGE_LIMIT } from "@/lib/plan-policy";
import type { TodoPlanV2 } from "@/types";

import styles from "./page.module.css";
import GoogleAd from "@/components/GoogleAd";


type InputMode = "text" | "image" | "pdf";

interface UserUsage {
  count: number;
  limit: number | null;
  last_reset_at: string;
}

export default function UploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { openModal } = useIosKakaoModal();

  const handleLogin = createStartClickHandler(() => {
    signIn("google", { callbackUrl: "/dashboard" });
  }, openModal);

  const [activeTab, setActiveTab] = useState<InputMode>('image');
  const [text, setText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [hasSavedResult, setHasSavedResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Pro Options States
  const [usePriority, setUsePriority] = useState(true);
  const [detailLevel, setDetailLevel] = useState<"brief" | "normal" | "detailed">("normal");
  const [customCategory, setCustomCategory] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      setHasSavedResult(readStoredTodoPlan(session?.user?.id) !== null);
      fetchUsage();
      fetchConsent();
      fetchHistory();
    } else {
      setHasSavedResult(false);
    }
  }, [status, session?.user?.id]);

  // 사용량(티어) 정보가 로드되면 무료 사용자의 경우 옵션 기본값 조정
  useEffect(() => {
    if (usage && usage.limit !== null) {
      // Pro가 아니면 우선순위 비활성화
      setUsePriority(false);
    }
  }, [usage]);

  async function fetchHistory() {
    try {
      const res = await fetch("/api/todo/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }

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

  async function fetchConsent() {
    try {
      const res = await fetch("/api/consent");
      if (res.ok) {
        const { agreed } = await res.json();
        if (!agreed) {
          setShowConsentModal(true);
        }
      }
    } catch (e) {
      console.error("Failed to fetch consent:", e);
    }
  }

  async function handleAgree() {
    try {
      const res = await fetch("/api/consent", { method: "POST" });
      if (res.ok) {
        setShowConsentModal(false);
      } else {
        const data = await res.json();
        setError(data.error || "동의 처리에 실패했습니다.");
      }
    } catch (e) {
      setError("동의 처리 중 오류가 발생했습니다.");
    }
  }

  function resetInputs(nextMode: InputMode) {
    setActiveTab(nextMode);
    setError(null);
    setImageFiles([]);
    setPdfFile(null);

    if (nextMode !== "text") {
      setText("");
    }
  }

  const isPro = usage?.limit === null;
  const upgradeHref = getUpgradeHref(status === "authenticated");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = (files: File[]) => {
    if (activeTab === 'image') {
      const validImages = files.filter(f => f.type.startsWith('image/'));
      if (validImages.length === 0) {
        setError("이미지 파일만 업로드 가능합니다.");
        return;
      }
      let newFiles = [...imageFiles, ...validImages];

      if (!isPro && newFiles.length > FREE_IMAGE_LIMIT) {
        setError(`무료 요금제에서는 이미지를 최대 ${FREE_IMAGE_LIMIT}장까지 업로드할 수 있습니다.`);
        newFiles = newFiles.slice(0, FREE_IMAGE_LIMIT);
      } else {
        setError(null);
      }
      setImageFiles(newFiles);
    } else {
      if (!isPro) {
        setError("PDF 분석은 Pro 플랜 전용 기능입니다.");
        return;
      }
      const validPdf = files.find(f => f.type === 'application/pdf');
      if (validPdf) {
        setPdfFile(validPdf);
        setError(null);
      } else {
        setError("PDF 파일만 업로드 가능합니다.");
      }
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    if (error?.includes(`최대 ${FREE_IMAGE_LIMIT}장`)) {
      setError(null);
    }
  };

  async function uploadToSignedUrl(file: File, uploadUrl: string) {
    if (file.type === 'application/pdf' && !isPro) {
      throw new Error("PDF 분석은 Pro 플랜 전용 기능입니다.");
    }
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    if (!response.ok) {
      throw new Error('파일 업로드에 실패했습니다.');
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    
    try {
      let body: Record<string, unknown>;

      const options = isPro ? {
        usePriority,
        detailLevel,
        customCategory: customCategory.trim() || undefined,
      } : undefined;

      if (activeTab === "text") {
        if (!text.trim()) {
          throw new Error("파서를 실행하기 전에 텍스트를 입력해 주세요.");
        }
        body = { type: "text", text: text.trim(), options };
      } else {
        const fileCount = activeTab === "image" ? imageFiles.length : 1;
        if (fileCount === 0 && activeTab === "image") {
          throw new Error("이미지를 한 장 이상 선택해 주세요.");
        }
        if (!pdfFile && activeTab === "pdf") {
          throw new Error("PDF 파일을 선택해 주세요.");
        }

        // 1. Get signed URLs
        const urlRes = await fetch("/api/parse/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: activeTab, fileCount }),
        });

        if (!urlRes.ok) {
          const errData = await urlRes.json();
          throw new Error(errData.error || "업로드 준비 중 오류가 발생했습니다.");
        }

        const { uploads } = await urlRes.json();
        const filesToUpload = activeTab === "image" ? imageFiles : [pdfFile!];

        // 2. Upload files to Supabase Storage
        await Promise.all(
          uploads.map((u: any, i: number) => uploadToSignedUrl(filesToUpload[i], u.uploadUrl))
        );

        // 3. Prepare body with storage paths
        if (activeTab === "image") {
          body = {
            type: "image",
            imageStoragePaths: uploads.map((u: any) => u.storagePath),
            options,
          };
        } else {
          body = {
            type: "pdf",
            pdfStoragePath: uploads[0].storagePath,
            options,
          };
        }
      }

      // 4. Call parse API
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "파서 요청 처리에 실패했습니다. 다시 시도해 주세요.";
        throw new Error(message);
      }

      const { id: savedId, ...planData } = payload as { id?: string } & TodoPlanV2;
      if (session?.user?.id && savedId) {
        writeStoredTodoPlan(planData, session.user.id);
      }
      setHasSavedResult(true);

      if (savedId) {
        router.push(`/todo?id=${savedId}`);
      } else {
        throw new Error("결과를 성공적으로 저장하지 못했습니다. 대시보드에서 확인해 주세요.");
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "파싱 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
      fetchUsage(); // Refresh usage after parsing
    }
  }

  const canSubmit =
    !loading &&
    status === "authenticated" &&
    ((activeTab === "text" && text.trim().length > 0) ||
      (activeTab === "image" && imageFiles.length > 0) ||
      (activeTab === "pdf" && pdfFile !== null));

  if (status === "unauthenticated") {
    return (
      <div className={styles.container}>
        <div style={{ padding: "40px", backgroundColor: "#fff", borderRadius: "14px", margin: "auto" }}>
          <h2>로그인이 필요합니다</h2>
          <button
            className={styles.generateButton}
            onClick={() => handleLogin()}
            style={{ marginTop: "20px" }}
          >
            Google로 로그인
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    clearStoredTodoPlan();
    await signOut({ callbackUrl: "/" });
  };




  return (
    <div className={styles.container}>
      {showConsentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>이용 약관 동의</h2>
            <div className={styles.modalContent}>
              ToDit 서비스를 이용하시려면 <Link href="/terms" target="_blank" className={styles.modalLink}>이용약관</Link> 및 <Link href="/privacy" target="_blank" className={styles.modalLink}>개인정보처리방침</Link>에 동의해 주셔야 합니다.
              <br /><br />
              본 서비스는 입력하신 문서를 AI로 분석하여 할 일을 추출하며, 분석 데이터는 서비스 향상을 위해 익명화되어 활용될 수 있습니다.
            </div>
            {error && <div className={styles.modalError}>{error}</div>}
            <button className={styles.modalAction} onClick={handleAgree}>
              동의하고 시작하기
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingModal}>
            <div className={styles.spinner}></div>
            <div className={styles.loadingText}>
              <h3>To-Do 플로우 생성 중...</h3>
              <p>AI가 문서를 꼼꼼히 분석하여<br />최적의 To-Do를 만들고 있습니다.</p>
              <div className={styles.loadingPulse}>잠시만 기다려 주세요</div>
            </div>

            {!isPro && (
              <div className={styles.loadingAdSection}>
                <span className={styles.loadingAdBadge}>ADVERTISEMENT</span>
                {/* Google AdSense Area */}
                <div className={styles.adContentArea}>
                  <GoogleAd slot="1035326864" format="rectangle" style={{ width: '100%', height: '250px' }} />
                  <p className={styles.adTimerSnippet}>{activeTab === 'text' ? '5초' : '10초'} 후 분석 결과가 나타납니다.</p>
                </div>
                <div className={styles.proCtaLink}>
                  <Link href="/plan" target="_blank" className={styles.loadingAdLink}>
                    Pro 업그레이드 보기
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.layout}>
        {/* Main Column Container */}
        <div className={styles.mainContainer}>
          <main className={styles.mainCard}>
            <header className={styles.pageHeader}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "bold" }}>새 작업 시작</h2>
                <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>
                  이미지, 문서 또는 텍스트를 입력하여 새로운 To-Do를 만드세요.
                </p>
              </div>
            </header>

            <nav className={styles.tabs} style={{ marginTop: "24px" }}>
              <button
                className={`${styles.tab} ${activeTab === 'image' ? styles.tabActive : ''}`}
                onClick={() => resetInputs('image')}
              >
                이미지
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'pdf' ? styles.tabActive : ''}`}
                onClick={() => {
                  if (!isPro) {
                    setError("PDF 분석은 Pro 플랜 전용 기능입니다.");
                  }
                  resetInputs('pdf');
                }}
              >
                문서 (PDF) {!isPro && <span style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: '4px' }}>PRO</span>}
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'text' ? styles.tabActive : ''}`}
                onClick={() => resetInputs('text')}
              >
                텍스트 붙여넣기
              </button>
            </nav>

            {activeTab !== 'text' ? (
              <div
                className={styles.dropzoneContainer}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <label className={styles.dropzone} htmlFor="file-upload" role="button" aria-label="Upload file">
                  <svg className={styles.dropIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <h2 className={styles.dropTitle}>
                    여기에 {activeTab === 'image' ? '이미지' : 'PDF 문서'}를 드롭하세요
                  </h2>
                  <p className={styles.dropDesc}>또는 클릭하여 내 컴퓨터에서 파일 찾기</p>

                  <div className={styles.fileButton}>파일 선택</div>

                  <input
                    id="file-upload"
                    type="file"
                    style={{ display: "none" }}
                    accept={activeTab === 'image' ? "image/*" : "application/pdf"}
                    multiple={activeTab === 'image'}
                    onChange={(e) => {
                      if (e.target.files) {
                        handleFiles(Array.from(e.target.files));
                      }
                      e.target.value = ''; // Reset to allow selecting the same file again
                    }}
                  />
                </label>

                {(imageFiles.length > 0 || pdfFile) && (
                  <div className={styles.fileListWrapper}>
                    {activeTab === 'image' && (
                      <>
                        <div className={styles.previewGrid}>
                          {imageFiles.map((file, idx) => (
                            <div key={`${file.name}-${idx}`} className={styles.previewItem}>
                              <img src={URL.createObjectURL(file)} alt="preview" className={styles.previewImage} />
                              <button
                                className={styles.removeBtn}
                                onClick={() => removeImage(idx)}
                                title="삭제"
                              >
                                &times;
                              </button>
                              <span className={styles.previewName}>{file.name}</span>
                            </div>
                          ))}
                        </div>
                        <p className={styles.fileListText}>{imageFiles.length}개의 파일 선택됨 {(!isPro) && `(무료 최대 ${FREE_IMAGE_LIMIT}장)`}</p>
                      </>
                    )}
                    {activeTab === 'pdf' && pdfFile && (
                      <div className={styles.pdfPreview}>
                        <span className={styles.fileIcon}>📄</span>
                        <p className={styles.fileListText}>{pdfFile.name}</p>
                        <button className={styles.removePdfBtn} onClick={() => setPdfFile(null)}>&times;</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <textarea
                className={styles.textInput}
                placeholder="강의 계획서, 회의록, 프로젝트 브리핑 또는 메모를 여기에 붙여넣으세요..."
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
              />
            )}

            {error && <div className={styles.errorBox}>{error}</div>}

            <button
              className={styles.generateButton}
              disabled={!canSubmit}
              onClick={handleSubmit}
              style={{ marginTop: "24px" }}
            >
              {loading ? "생성 중..." : "To-Do 생성"}
            </button>
          </main>
          {!isPro && (
            <div className={styles.adBanner} style={{ marginTop: "16px" }}>
              <div className={styles.adTitle}>ADVERTISEMENT</div>
              <GoogleAd slot="6096081852" format="horizontal" />
            </div>
          )}
        </div>

        {/* Sidebar Column */}
        <aside className={styles.sideContainer}>
          {/* History Card */}
          <div className={styles.sideCard}>
            <header className={styles.sideHeader}>
              <h3 className={styles.sideTitle}>최근 결과</h3>
            </header>

            {history.length > 0 ? (
              <div className={styles.historyList}>
                {history.map((item) => (
                  <div
                    key={item.id}
                    className={styles.historyItem}
                    onClick={() => router.push(`/todo?id=${item.id}`)}
                  >
                    <svg className={styles.historyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className={styles.historyContent}>
                      <div className={styles.historyItemTitle}>{item.title || "제목 없음"}</div>
                      <div className={styles.historyDate}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.historyList}>
                {hasSavedResult ? (
                  <div className={styles.historyItem} onClick={() => router.push("/todo")}>
                    <svg className={styles.historyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className={styles.historyContent}>
                      <div className={styles.historyItemTitle}>최근 생성 결과 보기</div>
                      <div className={styles.historyDate}>세션 데이터</div>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: "13px", color: "var(--muted)", padding: "8px" }}>저장된 최근 결과가 없습니다.</p>
                )}
              </div>
            )}
          </div>

          {/* Pro Options Card */}
          <div className={`${styles.sideCard} ${!isPro ? styles.disabledState : ''}`}>
            <header className={styles.sideHeader}>
              <h3 className={styles.sideTitle}>Pro 옵션</h3>
              {!isPro && <span className={styles.proBadge}>PRO</span>}
            </header>
            <div className={styles.proOptionsList}>
              {/* AI 모델 선택 삭제됨 */}

              <div className={styles.proOption}>
                <div>
                  <div className={styles.proOptionLabel}>우선순위 분석</div>
                  <div className={styles.proOptionDesc}>중요도에 따라 우선순위 할당</div>
                </div>
                <div
                  className={`${styles.toggle} ${usePriority ? styles.toggleActive : ''}`}
                  onClick={() => isPro && setUsePriority(!usePriority)}
                >
                  <div className={styles.toggleKnob}></div>
                </div>
              </div>

              <div className={styles.proOption}>
                <div style={{ width: '100%' }}>
                  <div className={styles.proOptionLabel}>분해 상세도</div>
                  <select
                    className={styles.proOptionSelect}
                    value={detailLevel}
                    onChange={(e) => setDetailLevel(e.target.value as any)}
                    disabled={!isPro}
                  >
                    <option value="brief">간략하게 (주요 단계만)</option>
                    <option value="normal">보통 (적절한 수준)</option>
                    <option value="detailed">상세하게 (최대한 잘게 쪼개기)</option>
                  </select>
                </div>
              </div>

              <div className={styles.proOption}>
                <div style={{ width: '100%' }}>
                  <div className={styles.proOptionLabel}>사용자 지정 카테고리</div>
                  <input
                    type="text"
                    className={styles.proOptionInput}
                    placeholder="예: 과제, 운동, 식단..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    disabled={!isPro}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Usage / Upgrade Card */}
          <div className={styles.limitsCard}>
            <div className={styles.limitsTitle}>{isPro ? "Pro 플랜" : "Free 플랜"}</div>
            <div className={styles.limitsBar}>
              <div
                className={styles.limitsFill}
                style={{
                  width: usage ? `${Math.min((usage.count / (usage.limit || 1)) * 100, 100)}%` : '0%'
                }}
              ></div>
            </div>
            <div className={styles.limitsText}>
              <span>{usage ? usage.count : "..."} / {usage?.limit ? usage.limit : "무제한"}회 생성</span>
              <span>
                {isPro ? "PDF 분석과 고급 옵션 활성화" : `${PRO_MONTHLY_PRICE_LABEL} · 광고 제거`}
              </span>
            </div>
            {isPro ? (
              <Link href="/plan" className={styles.upgradeLink}>
                플랜 상세 보기
              </Link>
            ) : (
              <a href={upgradeHref} className={styles.upgradeLink}>
                Pro 업그레이드
              </a>
            )}
          </div>

        </aside>
      </div>
    </div>
  );
}
