import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeStoragePath } from "@/lib/validators";

const PARSE_TEMP_BUCKET = "parse-temp";

/**
 * Download a file from parse-temp bucket. Used by parse API after client uploads via signed URL.
 * 경로가 안전한지 검증 후 다운로드합니다.
 */
export async function downloadFromParseTemp(path: string): Promise<Buffer> {
  const safePath = sanitizeStoragePath(path);
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }
  const { data, error } = await supabase.storage.from(PARSE_TEMP_BUCKET).download(safePath);
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("No data returned from storage");
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete one or more files from parse-temp bucket. Call after parse completes (success or failure).
 */
export async function deleteFromParseTemp(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const safePaths = paths.map(sanitizeStoragePath);
  const supabase = createAdminClient();
  if (!supabase) return;
  const { error } = await supabase.storage.from(PARSE_TEMP_BUCKET).remove(safePaths);
  if (error) {
    console.error("[parse-temp] Failed to delete:", paths, error.message);
  }
}
