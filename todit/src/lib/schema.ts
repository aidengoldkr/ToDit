import { z } from "zod";
import type {
  DocumentType,
  DraftTodo,
  DraftTodoPlanInput,
  LegacyActionItem,
  LegacyActionPlan,
  Priority,
  Todo,
  TodoPlanMeta,
  TodoPlanV2,
} from "@/types";

const PRIORITIES: Priority[] = ["high", "medium", "low"];
const DOCUMENT_TYPES: DocumentType[] = [
  "안내문",
  "공지문",
  "준비사항",
  "논설문",
  "보고서",
  "회의록",
  "체크리스트",
  "기타",
];

const PRIORITY_VALUES = PRIORITIES as [Priority, ...Priority[]];
const DOCUMENT_TYPE_VALUES = DOCUMENT_TYPES as [DocumentType, ...DocumentType[]];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PATH_RE = /^\d{4}(?:\.\d{4})*$/;

const NonEmptyString = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, { message: "title must not be empty" });

const OptionalCategory = z
  .string()
  .transform((value) => value.trim())
  .nullable()
  .optional()
  .transform((value) => {
    if (value == null) return null;
    return value.length > 0 ? value : null;
  });

const DueDateSchema = z.string().regex(DATE_RE, { message: "dueDate must be YYYY-MM-DD" }).nullable();

const MetaSchema = z
  .object({
    analysis: z.string().default(""),
    keywords: z.array(z.string()).default([]),
    keyPoints: z.array(z.string()).default([]),
    requirements: z.array(z.string()).default([]),
    unknowns: z.array(z.string()).default([]),
  })
  .strict();

type TodoSchemaType = z.ZodType<Todo>;
type DraftTodoSchemaType = z.ZodType<DraftTodo>;

const DraftTodoSchema: DraftTodoSchemaType = z.lazy(() =>
  z
    .object({
      title: NonEmptyString,
      category: OptionalCategory,
      documentType: z.enum(DOCUMENT_TYPE_VALUES).nullable().optional(),
      done: z.boolean().optional(),
      dueDate: DueDateSchema,
      priority: z.enum(PRIORITY_VALUES).optional(),
      children: z.array(DraftTodoSchema).default([]),
    })
    .strict()
);

const DraftTodoPlanSchema = z
  .object({
    root: DraftTodoSchema,
    meta: MetaSchema,
  })
  .strict();

const TodoSchema: TodoSchemaType = z.lazy(() =>
  z
    .object({
      id: z.string().uuid("todo.id must be a valid UUID"),
      title: NonEmptyString,
      category: OptionalCategory,
      documentType: z.enum(DOCUMENT_TYPE_VALUES).nullable(),
      done: z.boolean(),
      dueDate: DueDateSchema,
      priority: z.enum(PRIORITY_VALUES).optional(),
      parentId: z.string().uuid().nullable(),
      sortOrder: z.number().int().positive(),
      path: z.string().regex(PATH_RE, { message: "todo.path must be a dotted 4-digit path" }),
      children: z.array(TodoSchema),
    })
    .strict()
);

const TodoPlanSchema = z
  .object({
    schemaVersion: z.literal(2),
    root: TodoSchema,
    meta: MetaSchema,
  })
  .strict();

function getFirstValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid JSON: expected an object";
}

function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeOptionalCategory(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function padSortOrder(order: number): string {
  return order.toString().padStart(4, "0");
}

function getLatestDueDate(actions: LegacyActionItem[]): string | null {
  const dueDates = actions
    .map((action) => (typeof action.due === "string" && DATE_RE.test(action.due) ? action.due : null))
    .filter((due): due is string => due !== null);

  return dueDates.length > 0 ? dueDates.sort().at(-1) ?? null : null;
}

function buildMetaFromUnknown(data: Record<string, unknown>): TodoPlanMeta {
  return {
    analysis: typeof data.analysis === "string" ? data.analysis : "",
    keywords: normalizeTextArray(data.keywords),
    keyPoints: normalizeTextArray(data.keyPoints),
    requirements: normalizeTextArray(data.requirements),
    unknowns: normalizeTextArray(data.unknowns),
  };
}

function validateTreeShape(input: Todo, normalized: Todo) {
  if (input.path !== normalized.path) {
    throw new Error("todo.path does not match the tree order");
  }
  if (input.sortOrder !== normalized.sortOrder) {
    throw new Error("todo.sortOrder does not match the sibling order");
  }
  if (input.parentId !== normalized.parentId) {
    throw new Error("todo.parentId does not match the tree structure");
  }
  if (input.children.length !== normalized.children.length) {
    throw new Error("todo.children length changed during validation");
  }
  input.children.forEach((child, index) => validateTreeShape(child, normalized.children[index]));
}

function normalizeStoredTodoNode(
  input: Todo,
  parentId: string | null,
  sortOrder: number,
  pathPrefix?: string
): Todo {
  const path = pathPrefix ? `${pathPrefix}.${padSortOrder(sortOrder)}` : padSortOrder(sortOrder);
  const normalizedChildren = input.children.map((child, index) =>
    normalizeStoredTodoNode(child, input.id, index + 1, path)
  );
  const done = normalizedChildren.length > 0
    ? normalizedChildren.every((child) => child.done)
    : input.done === true;

  return {
    ...input,
    title: input.title.trim(),
    category: normalizeOptionalCategory(input.category),
    documentType: input.documentType ?? null,
    dueDate: input.dueDate,
    done,
    parentId,
    sortOrder,
    path,
    children: normalizedChildren,
  };
}

function hydrateDraftTodoNode(
  input: DraftTodo,
  parentId: string | null,
  sortOrder: number,
  pathPrefix?: string,
  inheritCategory = false,
  inheritDocumentType = false
): Todo {
  const id = crypto.randomUUID();
  const path = pathPrefix ? `${pathPrefix}.${padSortOrder(sortOrder)}` : padSortOrder(sortOrder);
  const children = input.children.map((child, index) =>
    hydrateDraftTodoNode(child, id, index + 1, path, true, true)
  );

  return {
    id,
    title: input.title.trim(),
    category: inheritCategory ? null : normalizeOptionalCategory(input.category),
    documentType: inheritDocumentType ? null : input.documentType ?? null,
    done: children.length > 0 ? children.every((child) => child.done) : input.done === true,
    dueDate: input.dueDate,
    priority: input.priority,
    parentId,
    sortOrder,
    path,
    children,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isLegacyActionPlan(value: unknown): value is LegacyActionPlan {
  return isRecord(value) && Array.isArray(value.actions);
}

export function validateDraftTodoPlanInput(data: unknown): DraftTodoPlanInput {
  const result = DraftTodoPlanSchema.safeParse(data);
  if (!result.success) {
    throw new Error(getFirstValidationError(result.error));
  }
  return result.data;
}

export function hydrateTodoTree(input: DraftTodoPlanInput): TodoPlanV2 {
  return {
    schemaVersion: 2,
    root: hydrateDraftTodoNode(input.root, null, 1),
    meta: input.meta,
  };
}

export function validateTodoPlanInput(data: unknown): TodoPlanV2 {
  const result = TodoPlanSchema.safeParse(data);
  if (!result.success) {
    throw new Error(getFirstValidationError(result.error));
  }

  const normalized = {
    schemaVersion: 2 as const,
    root: normalizeStoredTodoNode(result.data.root, null, 1),
    meta: result.data.meta,
  };

  validateTreeShape(result.data.root, normalized.root);
  return normalized;
}

export function normalizeLegacyActionPlanToTodoPlanV2(data: LegacyActionPlan): TodoPlanV2 {
  const meta = {
    analysis: data.analysis ?? "",
    keywords: data.keywords ?? [],
    keyPoints: data.keyPoints ?? [],
    requirements: data.requirements ?? [],
    unknowns: data.unknowns ?? [],
  };

  const rootId = crypto.randomUUID();
  const children = data.actions.map((action, index) => {
    const childId = crypto.randomUUID();
    return {
      id: childId,
      title: typeof action.task === "string" && action.task.trim().length > 0 ? action.task.trim() : `세부 할 일 ${index + 1}`,
      category: null,
      documentType: null,
      done: action.done === true,
      dueDate: typeof action.due === "string" && DATE_RE.test(action.due) ? action.due : null,
      priority: action.priority,
      parentId: rootId,
      sortOrder: index + 1,
      path: `0001.${padSortOrder(index + 1)}`,
      children: [],
    } satisfies Todo;
  });

  return {
    schemaVersion: 2,
    root: {
      id: rootId,
      title: typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : "제목 없는 To-Do",
      category: null,
      documentType: data.category ?? "기타",
      done: children.length > 0 ? children.every((child) => child.done) : false,
      dueDate: getLatestDueDate(data.actions),
      parentId: null,
      sortOrder: 1,
      path: "0001",
      children,
    },
    meta,
  };
}

export function normalizeStoredTodoPlan(data: unknown): TodoPlanV2 {
  if (isLegacyActionPlan(data)) {
    return normalizeLegacyActionPlanToTodoPlanV2(data);
  }

  if (!isRecord(data)) {
    throw new Error("Invalid JSON: expected an object");
  }

  const parsed = validateTodoPlanInput(data);
  return {
    schemaVersion: 2,
    root: parsed.root,
    meta: {
      analysis: parsed.meta.analysis,
      keywords: parsed.meta.keywords,
      keyPoints: parsed.meta.keyPoints,
      requirements: parsed.meta.requirements,
      unknowns: parsed.meta.unknowns,
    },
  };
}

export function normalizeDraftTodoPlanInput(data: unknown): DraftTodoPlanInput {
  if (!isRecord(data)) {
    throw new Error("Invalid JSON: expected an object");
  }

  if (isRecord(data.root) && isRecord(data.meta)) {
    return validateDraftTodoPlanInput(data);
  }

  if (isLegacyActionPlan(data)) {
    return {
      root: {
        title: typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : "제목 없는 To-Do",
        category: null,
        documentType: data.category ?? "기타",
        dueDate: getLatestDueDate(data.actions),
        children: data.actions.map((action) => ({
          title: typeof action.task === "string" ? action.task : "세부 할 일",
          dueDate: typeof action.due === "string" && DATE_RE.test(action.due) ? action.due : null,
          done: action.done === true,
          priority: action.priority,
          children: [],
        })),
      },
      meta: buildMetaFromUnknown(data),
    };
  }

  throw new Error("Invalid JSON: expected a TodoPlanV2 or legacy ActionPlan");
}
