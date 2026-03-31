import { ImageAnnotatorClient } from "@google-cloud/vision";

/** 권장: .env.local / 배포 환경 변수에 GOOGLE_APPLICATION_CREDENTIALS_JSON (서비스 계정 JSON 한 줄) 설정 */
function getClient(): ImageAnnotatorClient {
  let json = (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "").trim();

  // 환경 변수에 작은따옴표나 큰따옴표가 포함된 채로 들어오는 경우를 처리
  if (
    (json.startsWith("'") && json.endsWith("'")) ||
    (json.startsWith('"') && json.endsWith('"'))
  ) {
    json = json.slice(1, -1).trim();
  }

  if (json) {
    try {
      const credentials = JSON.parse(json) as {
        client_email?: string;
        private_key?: string;
        project_id?: string;
      };
      return new ImageAnnotatorClient({
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
        projectId: credentials.project_id,
      });
    } catch (parseError) {
      console.error("[Google-OCR] JSON Parse Error details:", parseError);
      throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is invalid");
    }
  }
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not set");
}

const VISION_BATCH_SIZE = 16;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Extract text from one or more base64-encoded images using Google Cloud Vision API (DOCUMENT_TEXT_DETECTION).
 * Images are sent in parallel batches (up to 16 per batch) via batchAnnotateImages.
 * Results are concatenated in order.
 */
export async function extractTextFromImages(
  imageBase64List: string[]
): Promise<string> {
  if (imageBase64List.length === 0) return "";

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON not configured");
  }

  const client = getClient();
  const batches = chunkArray(imageBase64List, VISION_BATCH_SIZE);

  const batchResults = await Promise.all(
    batches.map((batch) =>
      client.batchAnnotateImages({
        requests: batch.map((base64) => ({
          image: { content: base64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" as const }],
        })),
      })
    )
  );

  const parts = batchResults
    .flatMap(([response]) => response.responses ?? [])
    .map((r) => r.fullTextAnnotation?.text?.trim() ?? "")
    .filter(Boolean);

  return parts.join("\n\n");
}
