import { getFonnteConfig } from "@/lib/settings";

const DEFAULT_FONNTE_TIMEOUT_MS = 10_000;

export interface FonnteResult {
  status: boolean;
  msg?: string;
  [key: string]: unknown;
}

/**
 * Send a WhatsApp message via Fonnte. Bahasa Indonesia content stays at
 * the call site. Times out after 10 s and lets BullMQ retry.
 *
 * `fetchImpl` and `timeoutMs` are injectable for tests.
 */
export async function sendWhatsApp(
  phone: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = DEFAULT_FONNTE_TIMEOUT_MS
): Promise<FonnteResult> {
  const cfg = await getFonnteConfig();

  if (!cfg.token) {
    console.warn(
      `[whatsapp] Fonnte token kosong; skipping send to ${phone} (mock)`
    );
    return { status: true, msg: "MOCK_NO_TOKEN" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetchImpl(cfg.apiUrl, {
      method: "POST",
      headers: {
        Authorization: cfg.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target: phone, message: text }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      throw new Error(
        `Fonnte API error ${res.status}: ${res.statusText || "unknown"}`
      );
    }

    return (await res.json()) as FonnteResult;
  } finally {
    clearTimeout(timer);
  }
}
