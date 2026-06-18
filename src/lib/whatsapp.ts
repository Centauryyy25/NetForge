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

const DEFAULT_FONNTE_DOC_TIMEOUT_MS = 20_000;

/**
 * Send a document (e.g. receipt PDF) with a caption via Fonnte. Uploads the
 * file as multipart/form-data so no public URL is required. Times out after
 * 20 s by default and lets BullMQ retry.
 *
 * `fetchImpl` and `timeoutMs` are injectable for tests.
 */
export async function sendWhatsAppDocument(
  phone: string,
  caption: string,
  file: Buffer,
  filename: string,
  mimeType: string = "application/pdf",
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = DEFAULT_FONNTE_DOC_TIMEOUT_MS
): Promise<FonnteResult> {
  const cfg = await getFonnteConfig();

  if (!cfg.token) {
    console.warn(
      `[whatsapp] Fonnte token kosong; skipping document send to ${phone} (mock)`
    );
    return { status: true, msg: "MOCK_NO_TOKEN" };
  }

  const form = new FormData();
  form.append("target", phone);
  form.append("message", caption);
  form.append("file", new Blob([new Uint8Array(file)], { type: mimeType }), filename);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    // Do NOT set Content-Type — fetch adds the multipart boundary itself.
    const res = await fetchImpl(cfg.apiUrl, {
      method: "POST",
      headers: { Authorization: cfg.token },
      body: form,
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
