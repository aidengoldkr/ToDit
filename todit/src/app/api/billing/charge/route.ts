import { NextResponse } from "next/server";
import {
  chargeSubscriptionNow,
  getSubscriptionByUserId,
} from "@/lib/billing/service";
import { getServerSession } from "@/lib/auth";
import { extractUserIdFromCustomerUid } from "@/lib/portone/helpers";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type ChargeRequestBody = {
  customer_uid?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  let body: ChargeRequestBody = {};
  try {
    body = (await request.json()) as ChargeRequestBody;
  } catch {
    body = {};
  }

  const subscription = await getSubscriptionByUserId(session.user.id);
  const fallbackCustomerUid = body.customer_uid?.trim() || null;

  if (
    fallbackCustomerUid &&
    extractUserIdFromCustomerUid(fallbackCustomerUid) !== session.user.id
  ) {
    return jsonError("Invalid customer_uid.", 403);
  }

  const customerUid = subscription?.customer_uid || fallbackCustomerUid;

  if (!customerUid) {
    return jsonError("No saved billing key found.", 400);
  }

  if (extractUserIdFromCustomerUid(customerUid) !== session.user.id) {
    return jsonError("Subscription ownership mismatch.", 403);
  }

  if (subscription?.cancel_at_period_end) {
    return jsonError("Subscription is scheduled to cancel at period end.", 409);
  }

  try {
    const chargeResult = await chargeSubscriptionNow({
      userId: session.user.id,
      customerUid,
      buyerEmail: session.user.email,
      buyerName: session.user.name,
      pgProvider: subscription?.pg_provider,
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
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recurring billing failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
