"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PRO_PLAN_NAME } from "@/lib/billing";
import {
  buildBillingWebhookUrl,
  createCustomerUid,
  getMerchantUid,
} from "@/lib/portone/helpers";

type IamportRequestPayload = {
  channelKey: string;
  pay_method: string;
  merchant_uid: string;
  name: string;
  amount: number;
  customer_uid: string;
  notice_url: string;
  m_redirect_url: string;
  buyer_email?: string;
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

async function verifyBillingKeyIssue(payload: {
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
        : "구독 시작 처리에 실패했습니다."
    );
  }
}

export function SubButton(props: {
  userId: string;
  impCode: string;
  channelKey: string;
  buyerEmail?: string | null;
  className?: string;
  buttonText?: string;
}) {
  const {
    userId,
    impCode,
    channelKey,
    buyerEmail,
    className,
    buttonText = "카드 등록 후 구독 시작",
  } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledRedirectRef = useRef(false);

  useEffect(() => {
    if (!impCode || !channelKey) {
      return;
    }

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
  }, [channelKey, impCode]);

  useEffect(() => {
    const returned = searchParams.get("billing_return");
    const impUid = searchParams.get("imp_uid");
    const merchantUid = searchParams.get("merchant_uid");
    const customerUid = searchParams.get("customer_uid");

    if (
      handledRedirectRef.current ||
      returned !== "1" ||
      !impUid ||
      !merchantUid ||
      !customerUid
    ) {
      return;
    }

    handledRedirectRef.current = true;
    setLoading(true);
    setError(null);

    verifyBillingKeyIssue({
      imp_uid: impUid,
      merchant_uid: merchantUid,
      customer_uid: customerUid,
    })
      .then(() => {
        router.replace("/plan");
        router.refresh();
      })
      .catch((finalizeError) => {
        setError(
          finalizeError instanceof Error
            ? finalizeError.message
            : "구독 시작 처리에 실패했습니다."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router, searchParams]);

  async function handleSubscribe() {
    if (!channelKey) {
      setError("정기결제 채널이 설정되지 않았습니다.");
      return;
    }

    setError(null);
    setLoading(true);

    const customerUid = createCustomerUid(userId);
    const merchantUid = getMerchantUid(userId);

    try {
      await loadPortoneScript();
      if (!window.IMP) {
        throw new Error("PortOne SDK is unavailable.");
      }

      window.IMP.init(impCode);

      const origin =
        window.location.origin || process.env.NEXT_PUBLIC_APP_URL || "";
      const noticeUrl = buildBillingWebhookUrl(origin);
      const redirectUrl = `${origin.replace(
        /\/$/,
        ""
      )}/plan?billing_return=1&customer_uid=${encodeURIComponent(customerUid)}`;

      await new Promise<void>((resolve, reject) => {
        window.IMP?.request_pay(
          {
            channelKey,
            pay_method: "card",
            merchant_uid: merchantUid,
            name: PRO_PLAN_NAME,
            amount: 0,
            customer_uid: customerUid,
            buyer_email: buyerEmail || undefined,
            notice_url: noticeUrl,
            m_redirect_url: redirectUrl,
          },
          async (response) => {
            if (!response.success) {
              reject(
                new Error(
                  response.error_msg || "카드 등록이 완료되지 않았습니다."
                )
              );
              return;
            }

            if (!response.imp_uid || !response.merchant_uid) {
              reject(new Error("결제 응답에 필요한 정보가 없습니다."));
              return;
            }

            try {
              await verifyBillingKeyIssue({
                imp_uid: response.imp_uid,
                merchant_uid: response.merchant_uid,
                customer_uid: response.customer_uid || customerUid,
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
  const { className, buttonText = "자동 갱신 해지 예약" } = props;
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
