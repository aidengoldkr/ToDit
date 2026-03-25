export type Priority = "high" | "medium" | "low";

export type DocumentType =
  | "안내문"
  | "공지문"
  | "준비사항"
  | "논설문"
  | "보고서"
  | "회의록"
  | "체크리스트"
  | "기타";

export type Todo = {
  id: string;
  title: string;
  category: string | null;
  documentType: DocumentType | null;
  done: boolean;
  dueDate: string | null;
  priority?: Priority;
  parentId: string | null;
  sortOrder: number;
  path: string;
  children: Todo[];
};

export type TodoPlanMeta = {
  analysis: string;
  keywords: string[];
  keyPoints: string[];
  requirements: string[];
  unknowns: string[];
};

export type TodoPlanV2 = {
  schemaVersion: 2;
  root: Todo;
  meta: TodoPlanMeta;
};

export type DraftTodo = {
  title: string;
  category?: string | null;
  documentType?: DocumentType | null;
  done?: boolean;
  dueDate: string | null;
  priority?: Priority;
  children: DraftTodo[];
};

export type DraftTodoPlanInput = {
  root: DraftTodo;
  meta: TodoPlanMeta;
};

export type LegacyActionItem = {
  task: string;
  due: string | null;
  priority?: Priority;
  done?: boolean;
};

export type LegacyActionPlan = {
  category?: DocumentType;
  title?: string;
  analysis?: string;
  keywords?: string[];
  keyPoints?: string[];
  actions: LegacyActionItem[];
  requirements: string[];
  unknowns: string[];
};

export type ParseInput = {
  type: "image" | "pdf" | "text";
  imageBase64?: string;
  imagesBase64?: string[];
  imageStoragePaths?: string[];
  pdfBase64?: string;
  pdfStoragePath?: string;
  text?: string;
  options?: {
    model?: string;
    usePriority?: boolean;
    customCategory?: string;
    detailLevel?: "brief" | "normal" | "detailed";
  };
};

export type SavedTodoPlanRecord = {
  id: string;
  user_id: string;
  plan: TodoPlanV2;
  title: string | null;
  category: string | null;
  document_type: string | null;
  plan_version: number;
  created_at: string;
  updated_at: string;
};
