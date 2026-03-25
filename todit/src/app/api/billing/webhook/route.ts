import { NextResponse } from "next/server";
import {
  getPaymentStateFromPortone,
  resolveUserIdFromVerifiedPayment,
  syncCancelledPayment,
  syncFailedPayment,
  syncVerifiedPaidPayment,
} from "@/lib/billing/service";
import {
  isCancelledStatus,
  isFailedStatus,
  isPaidStatus,
} from "@/lib/portone/helpers";
import { getPaymentByImpUid } from "@/lib/portone/server";

type WebhookPayload = {
  imp_uid?: string;
  merchant_uid?: string;
  status?: string;
};

async function parseWebhookPayload(request: Request): Promise<WebhookPayload> {
  const contentType = request.headers.get("content-type") || "";
  const raw = await request.text();

  if (!raw) {
    return {};
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(raw) as WebhookPayload;
  }

  const params = new URLSearchParams(raw);
  return {
    imp_uid: params.get("imp_uid") || undefined,
    merchant_uid: params.get("merchant_uid") || undefined,
    status: params.get("status") || undefined,
  };
}

export async function POST(request: Request) {
  let payload: WebhookPayload;
  try {
    payload = await parseWebhookPayload(request);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (!payload.imp_uid) {
    return NextResponse.json({ error: "Missing imp_uid." }, { status: 400 });
  }

  try {
    const payment = await getPaymentByImpUid(payload.imp_uid);
    const userId = await resolveUserIdFromVerifiedPayment(payment);

    if (!userId) {
      return NextResponse.json({ received: true, ignored: true }, { status: 202 });
    }

    if (isPaidStatus(payment.status)) {
      await syncVerifiedPaidPayment({
        userId,
        customerUid: payment.customer_uid || "",
        payment,
      });
    } else if (isCancelledStatus(payment.status)) {
      await syncCancelledPayment({ userId, payment });
    } else if (isFailedStatus(payment.status) || payment.status) {
      await syncFailedPayment({
        userId,
        merchantUid: payment.merchant_uid,
        customerUid: payment.customer_uid || null,
        payment,
        errorMessage: payment.fail_reason || "Webhook sync marked payment as failed.",
      });
    }

    return NextResponse.json({
      received: true,
      status: getPaymentStateFromPortone(payment),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync billing webhook.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
