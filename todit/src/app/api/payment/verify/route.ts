import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { activateSubscription } from "@/lib/subscription";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { imp_uid, merchant_uid } = await req.json();

    if (!imp_uid) {
      return NextResponse.json({ error: "Missing imp_uid" }, { status: 400 });
    }

    // 1. 포트원 액세스 토큰(Access Token) 발급 받기
    const getToken = await fetch("https://api.iamport.kr/users/getToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imp_key: process.env.PORTONE_API_KEY, // REST API 키
        imp_secret: process.env.PORTONE_API_SECRET, // REST API Secret
      }),
    });

    const getTokenData = await getToken.json();

    if (getTokenData.code !== 0) {
      console.error("Portone Auth Error:", getTokenData.message);
      return NextResponse.json(
        { error: `Failed to get access token: ${getTokenData.message}` },
        { status: 500 }
      );
    }

    const { access_token } = getTokenData.response;

    // 2. imp_uid로 포트원 서버에서 결제 정보 조회
    const getPayment = await fetch(`https://api.iamport.kr/payments/${imp_uid}`, {
      method: "GET",
      headers: { Authorization: access_token },
    });

    const getPaymentData = await getPayment.json();
    if (getPaymentData.code !== 0) {
      console.error("Portone API Error:", getPaymentData.message);
      return NextResponse.json({ error: `Failed to get payment details: ${getPaymentData.message}` }, { status: 500 });
    }

    const paymentData = getPaymentData.response;

    // 3. 결제 금액 검증
    const expectedAmount = 2900; // Pro 플랜 가격
    if (paymentData.amount !== expectedAmount) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    // 4. 결제 상태 확인
    if (paymentData.status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    // 5. DB 업데이트 (구독 활성화)
    const success = await activateSubscription(session.user.id);
    if (!success) {
      return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Payment verified and subscription activated" });

  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
