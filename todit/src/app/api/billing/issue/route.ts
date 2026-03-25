import { NextResponse } from "next/server";
import {
  getPaymentStateFromPortone,
  getSubscriptionByUserId,
  syncCancelledPayment,
  syncFailedPayment,
  syncVerifiedPaidPayment,
} from "@/lib/billing/service";
import { PRO_MONTHLY_AMOUNT } from "@/lib/billing";
import { getServerSession } from "@/lib/auth";
import {
  getCustomerUid,
  isBillingAmountValid,
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

  const expectedCustomerUid = getCustomerUid(session.user.id);
  if (customerUid !== expectedCustomerUid) {
    return badRequest("Invalid customer_uid.", 403);
  }

  if (!merchantUid.startsWith(`todit_pro_${session.user.id}_`)) {
    return badRequest("Invalid merchant_uid.", 403);
  }

  const existingSubscription = await getSubscriptionByUserId(session.user.id);
  if (
    existingSubscription?.customer_uid &&
    existingSubscription.customer_uid !== expectedCustomerUid
  ) {
    return badRequest("Subscription ownership mismatch.", 403);
  }

  try {
    const payment = await getPaymentByImpUid(impUid);

    if (payment.merchant_uid !== merchantUid) {
      return badRequest("merchant_uid verification failed.", 403);
    }

    if (payment.customer_uid !== expectedCustomerUid) {
      return badRequest("customer_uid verification failed.", 403);
    }

    if (!isBillingAmountValid(payment.amount) || payment.amount !== PRO_MONTHLY_AMOUNT) {
      return badRequest("Invalid payment amount.", 403);
    }

    if (isPaidStatus(payment.status)) {
      await syncVerifiedPaidPayment({
        userId: session.user.id,
        customerUid: expectedCustomerUid,
        payment,
      });

      return NextResponse.json({
        success: true,
        status: getPaymentStateFromPortone(payment),
      });
    }

    if (isCancelledStatus(payment.status)) {
      await syncCancelledPayment({
        userId: session.user.id,
        payment,
      });

      return badRequest("Payment was cancelled.", 400);
    }

    if (isFailedStatus(payment.status) || payment.status) {
      await syncFailedPayment({
        userId: session.user.id,
        merchantUid,
        customerUid: expectedCustomerUid,
        payment,
        errorMessage: payment.fail_reason || "Payment verification failed.",
      });
    }

    return badRequest("Payment is not in a paid state.", 400);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify payment.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
