/**
 * Extract a human-facing error message from a failed `fetch` Response.
 *
 * API routes return JSON `{ error }`, but a request can also fail at the proxy
 * (e.g. the Cloudflare tunnel returning an HTML 502/504 page). Calling
 * `res.json()` blindly on that HTML throws "Unexpected token '<'", masking the
 * real status. This reads the body as text, tries JSON, and otherwise falls
 * back to a status-based Bahasa Indonesia message.
 */
export async function readApiError(
  res: Response,
  fallback = "Terjadi kesalahan"
): Promise<string> {
  const body = await res.text().catch(() => "");

  try {
    const json = JSON.parse(body) as { error?: string };
    if (json?.error) return json.error;
  } catch {
    // not JSON — proxy error page, empty body, etc.
  }

  if (res.status === 502 || res.status === 504) {
    return "Server tidak merespons (gateway). Coba lagi sebentar lagi.";
  }
  if (res.status === 401 || res.status === 403) {
    return "Sesi berakhir atau tidak diizinkan. Silakan masuk lagi.";
  }
  return `${fallback} (HTTP ${res.status})`;
}
