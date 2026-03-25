"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PRO_MONTHLY_AMOUNT,
  PRO_PLAN_NAME,
} from "@/lib/billing";
import { buildBillingWebhookUrl, getMerchantUid } from "@/lib/portone/helpers";

type IamportRequestPayload = {
  pg?: string;
  channelKey?: string;
  pay_method: string;
  merchant_uid: string;
  name: string;
  amount: number;
  customer_uid: string;
  notice_url: string;
  m_redirect_url: string;
  buyer_email?: string;
  buyer_name?: string;
};

type IamportResponse = {
  success: boolean;
  imp_uid?: string;
  merchant_uid?: string;
  customer_uid?: string;
  error_msg?: string;
};

type IamportInstance = {
  init: (impCode: string) => void;
  request_pay: (
    params: IamportRequestPayload,
    callback: (response: IamportResponse) => void
  ) => void;
};

declare global {
  interface Window {
    IMP?: IamportInstance;
  }
}

let portoneScriptPromise: Promise<void> | null = null;

function loadPortoneScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.IMP) {
    return Promise.resolve();
  }

  if (portoneScriptPromise) {
    return portoneScriptPromise;
  }

  portoneScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.iamport.kr/v1/iamport.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load PortOne SDK.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.iamport.kr/v1/iamport.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load PortOne SDK."));
    document.body.appendChild(script);
  });

  return portoneScriptPromise;
}

async function verifyIssuedPayment(payload: {
  imp_uid: string;
  merchant_uid: string;
  customer_uid: string;
}) {
  const response = await fetch("/api/billing/issue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "결제 검증에 실패했습니다."
    );
  }
}

export function SubButton(props: {
  userId: string;
  customerUid: string;
  impCode: string;
  channelKey?: string;
  pgProvider?: string;
  buyerEmail?: string | null;
  buyerName?: string | null;
  className?: string;
  buttonText?: string;
}) {
  const {
    userId,
    customerUid,
    impCode,
    channelKey,
    pgProvider,
    buyerEmail,
    buyerName,
    className,
    buttonText = "Pro 시작하기",
  } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledRedirectRef = useRef(false);

  useEffect(() => {
    let active = true;

    loadPortoneScript()
      .then(() => {
        if (!active || !window.IMP) {
          return;
        }

        window.IMP.init(impCode);
        setReady(true);
      })
      .catch((sdkError) => {
        if (!active) {
          return;
        }

        setError(
          sdkError instanceof Error
            ? sdkError.message
            : "결제 모듈을 불러오지 못했습니다."
        );
      });

    return () => {
      active = false;
    };
  }, [impCode]);

  useEffect(() => {
    const returned = searchParams.get("billing_return");
    const impUid = searchParams.get("imp_uid");
    const merchantUid = searchParams.get("merchant_uid");
    const returnedCustomerUid = searchParams.get("customer_uid");

    if (
      handledRedirectRef.current ||
      returned !== "1" ||
      !impUid ||
      !merchantUid ||
      !returnedCustomerUid
    ) {
      return;
    }

    handledRedirectRef.current = true;
    setLoading(true);
    verifyIssuedPayment({
      imp_uid: impUid,
      merchant_uid: merchantUid,
      customer_uid: returnedCustomerUid,
    })
      .then(() => {
        router.replace("/plan");
        router.refresh();
      })
      .catch((verifyError) => {
        setError(
          verifyError instanceof Error
            ? verifyError.message
            : "결제 검증에 실패했습니다."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router, searchParams]);

  async function handleSubscribe() {
    setError(null);
    setLoading(true);

    try {
      await loadPortoneScript();
      if (!window.IMP) {
        throw new Error("PortOne SDK is unavailable.");
      }

      window.IMP.init(impCode);

      const merchantUid = getMerchantUid(userId);
      const origin =
        window.location.origin || process.env.NEXT_PUBLIC_APP_URL || "";
      const noticeUrl = buildBillingWebhookUrl(origin);
      const redirectUrl = `${origin.replace(
        /\/$/,
        ""
      )}/plan?billing_return=1&customer_uid=${encodeURIComponent(customerUid)}`;
      const channelPayload =
        channelKey && channelKey.trim() !== ""
          ? { channelKey }
          : pgProvider && pgProvider.trim() !== ""
            ? { pg: pgProvider }
            : null;

      if (!channelPayload) {
        throw new Error("PORTONE_CHANNEL_KEY 또는 PORTONE_PG 설정이 필요합니다.");
      }

      await new Promise<void>((resolve, reject) => {
        window.IMP?.request_pay(
          {
            ...channelPayload,
            pay_method: "card",
            merchant_uid: merchantUid,
            name: PRO_PLAN_NAME,
            amount: PRO_MONTHLY_AMOUNT,
            customer_uid: customerUid,
            buyer_email: buyerEmail || undefined,
            notice_url: noticeUrl,
            m_redirect_url: redirectUrl,
          },
          async (response) => {
            if (!response.success || !response.imp_uid || !response.merchant_uid) {
              reject(
                new Error(response.error_msg || "결제가 완료되지 않았습니다.")
              );
              return;
            }

            try {
              await verifyIssuedPayment({
                imp_uid: response.imp_uid,
                merchant_uid: response.merchant_uid,
                customer_uid: customerUid,
              });
              resolve();
            } catch (verifyError) {
              reject(verifyError);
            }
          }
        );
      });

      router.refresh();
    } catch (subscribeError) {
      setError(
        subscribeError instanceof Error
          ? subscribeError.message
          : "구독 시작에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={!ready || loading}
        onClick={handleSubscribe}
      >
        {loading ? "처리 중..." : buttonText}
      </button>
      {error ? (
        <p style={{ marginTop: "12px", fontSize: "14px", color: "#b42318" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CancelSubscriptionButton(props: {
  className?: string;
  buttonText?: string;
}) {
  const { className, buttonText = "해지 예약하기" } = props;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "구독 해지 예약에 실패했습니다."
        );
      }

      router.refresh();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "구독 해지 예약에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={loading}
        onClick={handleCancel}
      >
        {loading ? "처리 중..." : buttonText}
      </button>
      {error ? (
        <p style={{ marginTop: "12px", fontSize: "14px", color: "#b42318" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
