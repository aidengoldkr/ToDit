import { NextResponse } from "next/server";
import {
  cancelSubscriptionAtPeriodEnd,
  getSubscriptionByUserId,
} from "@/lib/billing/service";
import { getServerSession } from "@/lib/auth";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const subscription = await getSubscriptionByUserId(session.user.id);
  if (!subscription) {
    return jsonError("Subscription not found.", 404);
  }

  const updatedSubscription = await cancelSubscriptionAtPeriodEnd(session.user.id);
  return NextResponse.json({
    success: true,
    subscription: updatedSubscription,
  });
}
