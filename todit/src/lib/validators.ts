import { z } from "zod";

export const ParseInputSchema = z
  .object({
    type: z.enum(["image", "pdf", "text"]),
    imageBase64: z.string().optional(),
    imagesBase64: z.array(z.string()).optional(),
    imageStoragePaths: z.array(z.string()).optional(),
    pdfBase64: z.string().optional(),
    pdfStoragePath: z.string().optional(),
    text: z.string().optional(),
    options: z
      .object({
        model: z.string().optional(),
        usePriority: z.boolean().optional(),
        customCategory: z.string().optional(),
        detailLevel: z.enum(["brief", "normal", "detailed"]).optional(),
      })
      .optional(),
  })
  .refine(
    (d) => {
      if (d.type === "text") return !!d.text;
      if (d.type === "pdf") return !!d.pdfBase64 || !!d.pdfStoragePath;
      if (d.type === "image") {
        return (
          !!d.imageBase64 ||
          (Array.isArray(d.imagesBase64) && d.imagesBase64.length > 0) ||
          (Array.isArray(d.imageStoragePaths) && d.imageStoragePaths.length > 0)
        );
      }
      return false;
    },
    { message: "입력 데이터가 type에 맞지 않습니다." }
  );

export type ValidatedParseInput = z.infer<typeof ParseInputSchema>;

export const UploadUrlSchema = z.object({
  type: z.enum(["image", "pdf"]),
  fileCount: z.coerce.number().int().min(1).max(30).default(1),
});

export const TodoIdSchema = z.string().uuid("유효한 ID 형식이 아닙니다.");

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  category: z.string().default("all"),
  documentType: z.string().default("all"),
  search: z.string().default(""),
});

const SAFE_PATH_RE = /^[a-zA-Z0-9_\-/]+\.[a-zA-Z0-9]+$/;

export function sanitizeStoragePath(path: string): string {
  if (path.includes("..") || path.startsWith("/") || path.startsWith("\\")) {
    throw new Error("잘못된 스토리지 경로입니다.");
  }
  if (!SAFE_PATH_RE.test(path)) {
    throw new Error("잘못된 스토리지 경로 형식입니다.");
  }
  return path;
}

export function validateStoragePathOwnership(path: string, userId: string): string {
  const sanitized = sanitizeStoragePath(path);
  if (!sanitized.startsWith(`${userId}/`)) {
    throw new Error("해당 파일에 대한 접근 권한이 없습니다.");
  }
  return sanitized;
}
