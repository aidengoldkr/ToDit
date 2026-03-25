import type {
  PortoneApiResponse,
  PortoneCancelPaymentRequest,
  PortonePayment,
  PortoneRecurringPaymentRequest,
  PortoneTokenResponse,
} from "@/lib/portone/types";

const PORTONE_API_BASE = "https://api.iamport.kr";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function assertPortoneEnv() {
  if (!process.env.PORTONE_API_KEY || !process.env.PORTONE_API_SECRET) {
    throw new Error("PortOne server credentials are missing.");
  }
}

async function parsePortoneJson<T>(response: Response): Promise<T> {
  const json = (await response.json()) as PortoneApiResponse<T>;

  if (!response.ok || json.code !== 0 || !json.response) {
    throw new Error(json.message || "PortOne API request failed.");
  }

  return json.response;
}

export async function getPortoneAccessToken(
  forceRefresh = false
): Promise<string> {
  assertPortoneEnv();

  if (
    !forceRefresh &&
    tokenCache &&
    tokenCache.expiresAt - 10_000 > Date.now()
  ) {
    return tokenCache.accessToken;
  }

  const response = await fetch(`${PORTONE_API_BASE}/users/getToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imp_key: process.env.PORTONE_API_KEY,
      imp_secret: process.env.PORTONE_API_SECRET,
    }),
    cache: "no-store",
  });

  const json = await parsePortoneJson<PortoneTokenResponse>(response);
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: json.expired_at * 1000,
  };

  return json.access_token;
}

async function portoneFetch<T>(
  path: string,
  init?: RequestInit,
  retry = true
): Promise<T> {
  const token = await getPortoneAccessToken();
  const response = await fetch(`${PORTONE_API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (response.status === 401 && retry) {
    await getPortoneAccessToken(true);
    return portoneFetch<T>(path, init, false);
  }

  return parsePortoneJson<T>(response);
}

export async function getPaymentByImpUid(impUid: string): Promise<PortonePayment> {
  return portoneFetch<PortonePayment>(`/payments/${impUid}`, {
    method: "GET",
  });
}

export async function requestBillingPaymentAgain(
  params: PortoneRecurringPaymentRequest
): Promise<PortonePayment> {
  return portoneFetch<PortonePayment>("/subscribe/payments/again", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function cancelPaymentByImpUid(
  params: PortoneCancelPaymentRequest
): Promise<PortonePayment> {
  return portoneFetch<PortonePayment>("/payments/cancel", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
