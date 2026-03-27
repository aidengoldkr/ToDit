import { NextResponse } from "next/server";
import {
  chargeSubscriptionNow,
  ensureInactiveSubscription,
  getExpiredActiveSubscriptions,
  getSubscriptionsDueForRenewal,
} from "@/lib/billing/service";

function getCronSecretError(request: Request): {
  message: string;
  status: number;
} | null {
  const secret = process.env.BILLING_CRON_SECRET;
  if (!secret) {
    return {
      message: "BILLING_CRON_SECRET is not configured.",
      status: 500,
    };
  }

  const bearerToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const headerToken = request.headers.get("x-billing-cron-secret")?.trim();
  const provided = bearerToken || headerToken;

  if (!provided) {
    return {
      message: "Missing cron secret.",
      status: 401,
    };
  }

  if (provided !== secret) {
    return {
      message: "Invalid cron secret.",
      status: 403,
    };
  }

  return null;
}

export async function POST(request: Request) {
  const authError = getCronSecretError(request);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status });
  }

  const nowIso = new Date().toISOString();

  try {
    const dueSubscriptions = await getSubscriptionsDueForRenewal(nowIso);
    let renewedCount = 0;
    let failedCount = 0;
    const failures: Array<{ user_id: string; error: string }> = [];

    for (const subscription of dueSubscriptions) {
      if (!subscription.customer_uid) {
        failedCount += 1;
        failures.push({
          user_id: subscription.user_id,
          error: "Missing customer_uid.",
        });
        await ensureInactiveSubscription(subscription.user_id).catch(() => undefined);
        continue;
      }

      try {
        const result = await chargeSubscriptionNow({
          userId: subscription.user_id,
          customerUid: subscription.customer_uid,
          pgProvider: subscription.pg_provider,
        });

        if (result.success) {
          renewedCount += 1;
        } else {
          failedCount += 1;
          failures.push({
            user_id: subscription.user_id,
            error: result.error,
          });
        }
      } catch (error) {
        failedCount += 1;
        failures.push({
          user_id: subscription.user_id,
          error:
            error instanceof Error
              ? error.message
              : "Failed to renew subscription.",
        });
      }
    }

    const expiredSubscriptions = await getExpiredActiveSubscriptions(nowIso);
    let inactivatedCount = 0;

    for (const subscription of expiredSubscriptions) {
      await ensureInactiveSubscription(subscription.user_id);
      inactivatedCount += 1;
    }

    return NextResponse.json({
      success: true,
      processed_at: nowIso,
      due_count: dueSubscriptions.length,
      renewed_count: renewedCount,
      failed_count: failedCount,
      inactivated_count: inactivatedCount,
      failures,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to renew subscriptions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
