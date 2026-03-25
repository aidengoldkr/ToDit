export type PlanTier = "free" | "pro";

export const PLAN_RESTRICTION_STATUS = 403;
export const FREE_IMAGE_LIMIT = 5;
export const PRO_IMAGE_LIMIT = 50;

type UploadPolicyInput = {
  tier: PlanTier;
  type: "image" | "pdf";
  fileCount: number;
};

type ParsePolicyInput = {
  tier: PlanTier;
  type: "image" | "pdf" | "text";
  imageCount: number;
};

export class PlanRestrictionError extends Error {
  status: number;
  code: string;

  constructor(message: string) {
    super(message);
    this.name = "PlanRestrictionError";
    this.status = PLAN_RESTRICTION_STATUS;
    this.code = "PLAN_RESTRICTED";
  }
}

export function isPdfAllowed(tier: PlanTier): boolean {
  return tier === "pro";
}

export function getMaxImageCount(tier: PlanTier): number {
  return tier === "pro" ? PRO_IMAGE_LIMIT : FREE_IMAGE_LIMIT;
}

export function getRequestedImageCount(input: {
  imageStoragePaths?: string[];
  imagesBase64?: string[];
  imageBase64?: string;
}): number {
  if (Array.isArray(input.imageStoragePaths) && input.imageStoragePaths.length > 0) {
    return input.imageStoragePaths.length;
  }
  if (Array.isArray(input.imagesBase64) && input.imagesBase64.length > 0) {
    return input.imagesBase64.length;
  }
  return input.imageBase64 ? 1 : 0;
}

export function assertUploadRequestAllowed({
  tier,
  type,
  fileCount,
}: UploadPolicyInput): void {
  if (type === "pdf" && !isPdfAllowed(tier)) {
    throw new PlanRestrictionError("PDF 분석은 Pro 기능입니다.");
  }

  if (type === "image" && fileCount > getMaxImageCount(tier)) {
    throw new PlanRestrictionError(
      `현재 요금제에서는 이미지를 최대 ${getMaxImageCount(tier)}장까지 업로드할 수 있습니다.`
    );
  }
}

export function assertParseRequestAllowed({
  tier,
  type,
  imageCount,
}: ParsePolicyInput): void {
  if (type === "pdf" && !isPdfAllowed(tier)) {
    throw new PlanRestrictionError("PDF 분석은 Pro 기능입니다.");
  }

  if (type === "image" && imageCount > getMaxImageCount(tier)) {
    throw new PlanRestrictionError(
      `현재 요금제에서는 이미지를 최대 ${getMaxImageCount(tier)}장까지 처리할 수 있습니다.`
    );
  }
}
