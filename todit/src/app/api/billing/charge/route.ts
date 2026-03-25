import { NextResponse } from "next/server";
import {
  getPaymentStateFromPortone,
  getSubscriptionByUserId,
  recordPendingChargeAttempt,
  syncCancelledPayment,
  syncFailedPayment,
  syncVerifiedPaidPayment,
} from "@/lib/billing/service";
import {
  PRO_MONTHLY_AMOUNT,
  PRO_PLAN_NAME,
} from "@/lib/billing";
import { getServerSession } from "@/lib/auth";
import {
  getMerchantUid,
  isCancelledStatus,
  isFailedStatus,
  isPaidStatus,
} from "@/lib/portone/helpers";
import {
  getPaymentByImpUid,
  requestBillingPaymentAgain,
} from "@/lib/portone/server";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const subscription = await getSubscriptionByUserId(session.user.id);
  if (!subscription?.customer_uid) {
    return jsonError("No saved billing key found.", 400);
  }

  if (subscription.cancel_at_period_end) {
    return jsonError("Subscription is scheduled to cancel at period end.", 409);
  }

  const merchantUid = getMerchantUid(session.user.id);
  await recordPendingChargeAttempt({
    userId: session.user.id,
    merchantUid,
    customerUid: subscription.customer_uid,
    amount: PRO_MONTHLY_AMOUNT,
    pgProvider: subscription.pg_provider,
  });

  try {
    const recurringPayment = await requestBillingPaymentAgain({
      customer_uid: subscription.customer_uid,
      merchant_uid: merchantUid,
      amount: PRO_MONTHLY_AMOUNT,
      name: PRO_PLAN_NAME,
      buyer_email: session.user.email || undefined,
      buyer_name: session.user.name || undefined,
    });

    const verifiedPayment = recurringPayment.imp_uid
      ? await getPaymentByImpUid(recurringPayment.imp_uid).catch(() => recurringPayment)
      : recurringPayment;

    if (isPaidStatus(verifiedPayment.status)) {
      await syncVerifiedPaidPayment({
        userId: session.user.id,
        customerUid: subscription.customer_uid,
        payment: verifiedPayment,
      });

      return NextResponse.json({
        success: true,
        status: getPaymentStateFromPortone(verifiedPayment),
        merchant_uid: merchantUid,
      });
    }

    if (isCancelledStatus(verifiedPayment.status)) {
      await syncCancelledPayment({
        userId: session.user.id,
        payment: verifiedPayment,
      });

      return jsonError("Payment was cancelled.", 400);
    }

    if (isFailedStatus(verifiedPayment.status) || verifiedPayment.status) {
      await syncFailedPayment({
        userId: session.user.id,
        merchantUid,
        customerUid: subscription.customer_uid,
        payment: verifiedPayment,
        errorMessage:
          verifiedPayment.fail_reason || "Recurring billing request failed.",
      });

      return jsonError("Recurring billing request failed.", 400);
    }

    await syncFailedPayment({
      userId: session.user.id,
      merchantUid,
      customerUid: subscription.customer_uid,
      payment: verifiedPayment,
      errorMessage: "Recurring billing did not return a paid result.",
    });

    return jsonError("Recurring billing did not return a paid result.", 400);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recurring billing failed.";

    await syncFailedPayment({
      userId: session.user.id,
      merchantUid,
      customerUid: subscription.customer_uid,
      errorMessage: message,
    }).catch(() => undefined);

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
