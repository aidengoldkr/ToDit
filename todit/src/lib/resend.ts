import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn("RESEND_API_KEY가 설정되지 않았습니다. 메일 발송 기능이 작동하지 않을 수 있습니다.");
}

export const resend = new Resend(process.env.RESEND_API_KEY);
