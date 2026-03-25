export type PortonePaymentStatus =
  | "ready"
  | "paid"
  | "failed"
  | "cancelled"
  | "cancel_requested"
  | string;

export type PortoneApiResponse<T> = {
  code: number;
  message?: string;
  response?: T;
};

export type PortoneTokenResponse = {
  access_token: string;
  now: number;
  expired_at: number;
};

export type PortonePayment = {
  imp_uid: string;
  merchant_uid: string;
  customer_uid?: string | null;
  status: PortonePaymentStatus;
  amount: number;
  currency?: string | null;
  name?: string | null;
  paid_at?: number | null;
  failed_at?: number | null;
  cancelled_at?: number | null;
  fail_reason?: string | null;
  cancel_reason?: string | null;
  pg_provider?: string | null;
  pay_method?: string | null;
  receipt_url?: string | null;
  buyer_email?: string | null;
  buyer_name?: string | null;
  card_name?: string | null;
  card_number?: string | null;
};

export type PortoneRecurringPaymentRequest = {
  customer_uid: string;
  merchant_uid: string;
  amount: number;
  name: string;
  buyer_email?: string;
  buyer_name?: string;
};

export type PortoneCancelPaymentRequest = {
  imp_uid?: string;
  merchant_uid?: string;
  reason?: string;
  amount?: number;
  checksum?: number;
};
