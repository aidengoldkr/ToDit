"use client";

import { useState, useCallback } from "react";

// I'mport(Portone) global interface declaration
declare global {
  interface Window {
    IMP: any;
  }
}

interface RequestPaymentParams {
  orderName?: string;
  amount?: number;
  customerName?: string;
  customerEmail?: string;
}

export const usePayment = () => {
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  const requestPayment = useCallback(async ({
    orderName = "ToDit Pro 1개월 구독",
    amount = 2900,
    customerName = "테스트 유저",
    customerEmail = "test@todit.app",
  }: RequestPaymentParams = {}): Promise<any> => {
    return new Promise((resolve) => {
      const { IMP } = window;
      if (!IMP) {
        alert("결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        return resolve(null);
      }

      // 1. 가맹점 식별코드 초기화
      const userCode = process.env.NEXT_PUBLIC_PORTONE_IMP_UID || "imp10433730"; // 기본 테스트용 UID (imp10433730)
      console.log("Portone init with:", userCode);
      IMP.init(userCode);

      const merchant_uid = `mid_${Date.now()}`;

      setIsPaymentLoading(true);

      // 2. 결제 요청
      // kakaopay.TCSUBSCRP는 포트원 테스트 계정(imp10433730) 전용입니다.
      // 개인 계정(imp16045837)을 사용할 경우 "kakaopay" 또는 관리자 콘솔에 등록된 채널 코드를 사용해야 합니다.
      const pgValue = "kakaopay"; 
      console.log("Request payment with PG:", pgValue);

      // 정기 구독(빌링키 발급)을 위해서는 유저별 고유한 customer_uid가 필요합니다.
      // NextAuth에서 발급된 session.user.id(UUID 등)가 일관되게 사용되는 것이 가장 좋습니다.
      const customer_uid = `user_${merchant_uid.split('_')[1]}`; 

      IMP.request_pay(
        {
          pg: pgValue, 
          pay_method: "card", // 카카오페이의 경우 "card" 또는 "kakaopay"
          merchant_uid,
          name: orderName,
          amount,
          buyer_email: customerEmail,
          buyer_name: customerName,
          customer_uid, 
          // m_redirect_url: "" // 카카오페이는 리다이렉트 없이 콜백 지원
        },
        async (rsp: any) => {
          setIsPaymentLoading(false);
          if (rsp.success) {
            // 결제 성공 시 결제 정보를 반환하여 호출부에서 서버 검증을 진행하도록 함
            resolve(rsp);
          } else {
            // 결제 실패 시 에러 처리
            console.error("결제 실패:", rsp.error_msg);
            alert(`결제 실패: ${rsp.error_msg}`);
            resolve(null);
          }
        }
      );
    });
  }, []);

  return { requestPayment, isPaymentLoading };
};

