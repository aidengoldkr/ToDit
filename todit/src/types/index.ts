export type Priority = "high" | "medium" | "low";

/** 문서 유형 — 카테고리 기반 행동 네이밍에 사용 */
export type DocumentCategory =
  | "안내문"
  | "공지문"
  | "준비사항"
  | "논설문"
  | "보고서"
  | "회의록"
  | "체크리스트"
  | "기타";

export type ActionItem = {
  task: string;
  due: string | null;
  priority?: Priority;
  /** 완료 여부. DB 반영 */
  done?: boolean;
};

export type ActionPlan = {
  /** 문서 유형 (AI 판단). 없으면 "기타"로 간주 */
  category?: DocumentCategory;
  /** AI가 생성한 제목 (전체 맥락 반영). */
  title?: string;
  /** AI가 이해한 이미지/파일 내용 요약 (2~5문장). 문서가 무엇인지에 초점. */
  analysis?: string;
  /** 문서 핵심 키워드 (한눈에 보는 태그). */
  keywords?: string[];
  /** 문서 내부에서 나온 정보를 정리한 핵심 포인트 (불릿 형태). */
  keyPoints?: string[];
  actions: ActionItem[];
  requirements: string[];
  unknowns: string[];
};

export type ParseInput = {
  type: "image" | "pdf" | "text";
  imageBase64?: string;
  /** 여러 이미지 (최대 5개). 있으면 imageBase64 대신 사용 */
  imagesBase64?: string[];
  /** Supabase Storage parse-temp 경로 (복수). imageStoragePaths 사용 시 base64 생략 가능 */
  imageStoragePaths?: string[];
  pdfBase64?: string;
  /** Supabase Storage parse-temp 경로 (단일). pdfStoragePath 사용 시 pdfBase64 생략 가능 */
  pdfStoragePath?: string;
  text?: string;
  /** Pro 전용 옵션 */
  options?: {
    model?: string;
    usePriority?: boolean;
    customCategory?: string;
    detailLevel?: "brief" | "normal" | "detailed";
  };
};

export type SavedActionPlan = {
  id: string;
  user_id: string;
  plan: ActionPlan;
  title: string | null;
  created_at: string;
};
