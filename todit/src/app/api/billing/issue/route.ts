import { NextResponse } from "next/server";
import {
  chargeSubscriptionNow,
  getPaymentStateFromPortone,
  getSubscriptionByUserId,
} from "@/lib/billing/service";
import { getServerSession } from "@/lib/auth";
import {
  extractUserIdFromCustomerUid,
  isBillingKeyIssueAmountValid,
  isCancelledStatus,
  isFailedStatus,
  isPaidStatus,
} from "@/lib/portone/helpers";
import { getPaymentByImpUid } from "@/lib/portone/server";

type IssueRequestBody = {
  imp_uid?: string;
  merchant_uid?: string;
  customer_uid?: string;
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return badRequest("Unauthorized", 401);
  }

  let body: IssueRequestBody;
  try {
    body = (await request.json()) as IssueRequestBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const impUid = body.imp_uid?.trim();
  const merchantUid = body.merchant_uid?.trim();
  const customerUid = body.customer_uid?.trim();

  if (!impUid || !merchantUid || !customerUid) {
    return badRequest("imp_uid, merchant_uid, customer_uid are required.");
  }

  if (extractUserIdFromCustomerUid(customerUid) !== session.user.id) {
    return badRequest("Invalid customer_uid.", 403);
  }

  if (!merchantUid.startsWith(`todit_pro_${session.user.id}_`)) {
    return badRequest("Invalid merchant_uid.", 403);
  }

  const existingSubscription = await getSubscriptionByUserId(session.user.id);

  try {
    const payment = await getPaymentByImpUid(impUid);

    if (payment.merchant_uid !== merchantUid) {
      return badRequest("merchant_uid verification failed.", 403);
    }

    if (payment.customer_uid !== customerUid) {
      return badRequest("customer_uid verification failed.", 403);
    }

    if (!isBillingKeyIssueAmountValid(payment.amount)) {
      return badRequest("Invalid billing key issue amount.", 403);
    }

    if (!isPaidStatus(payment.status)) {
      if (isCancelledStatus(payment.status)) {
        return badRequest("Billing key issuance was cancelled.", 400);
      }

      if (isFailedStatus(payment.status) || payment.status) {
        return badRequest(
          payment.fail_reason || "Billing key issuance failed.",
          400
        );
      }
    }

    const chargeResult = await chargeSubscriptionNow({
      userId: session.user.id,
      customerUid,
      buyerEmail: session.user.email,
      buyerName: session.user.name,
      pgProvider: payment.pg_provider || existingSubscription?.pg_provider || null,
    });

    if (!chargeResult.success) {
      return NextResponse.json(
        {
          error: chargeResult.error,
          status: chargeResult.status,
          merchant_uid: chargeResult.merchantUid,
        },
        { status: chargeResult.statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      status: chargeResult.status,
      merchant_uid: chargeResult.merchantUid,
      billing_key_issue_status: getPaymentStateFromPortone(payment),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify payment.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
