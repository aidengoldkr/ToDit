import { ImageAnnotatorClient } from "@google-cloud/vision";

/** 권장: .env.local / 배포 환경 변수에 GOOGLE_APPLICATION_CREDENTIALS_JSON (서비스 계정 JSON 한 줄) 설정 */
function getClient(): ImageAnnotatorClient {
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
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
    } catch {
      throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is invalid");
    }
  }
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not set");
}

/**
 * Extract text from one or more base64-encoded images using Google Cloud Vision API (DOCUMENT_TEXT_DETECTION).
 * Results are concatenated in order. Returns empty string if no credentials are configured.
 */
export async function extractTextFromImages(
  imageBase64List: string[]
): Promise<string> {
  if (imageBase64List.length === 0) return "";

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON not configured");
  }

  const client = getClient();
  const parts: string[] = [];

  for (const base64 of imageBase64List) {
    const [result] = await client.documentTextDetection({
      image: { content: base64 },
    });
    const fullText = result.fullTextAnnotation?.text?.trim();
    if (fullText) parts.push(fullText);
  }

  return parts.join("\n\n");
}
