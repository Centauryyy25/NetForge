import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { getFonnteConfig } from "@/lib/settings";

/**
 * Test the Fonnte WhatsApp connection by sending a test message. Accepts an
 * optional `token`/`apiUrl` in the body so the admin can test the value
 * currently typed in the form before saving; falls back to saved config.
 *
 * Always responds HTTP 200 with `{ success }` so the client can render the
 * Fonnte error reason (e.g. disconnected device) without throwing.
 */
export const POST = withErrorHandler(async (req) => {
  await requireRole(["admin"]);

  const body = await req.json().catch(() => ({}));
  const phone: string = (body.phone ?? "").toString().trim();
  if (!phone) {
    return NextResponse.json(
      { success: false, error: "Nomor tujuan wajib diisi" },
      { status: 400 }
    );
  }

  const saved = await getFonnteConfig();
  const token: string = (body.token ?? "").toString().trim() || saved.token;
  const apiUrl: string =
    (body.apiUrl ?? "").toString().trim() || saved.apiUrl;

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Token Fonnte belum diisi" },
      { status: 400 }
    );
  }

  const message =
    "✅ Tes koneksi WhatsApp dari NetForge. Jika pesan ini diterima, " +
    "gateway Fonnte sudah terhubung dengan benar.";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target: phone, message }),
      signal: ctrl.signal,
    });

    const result = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      reason?: string;
      detail?: string;
      [key: string]: unknown;
    };

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Fonnte API error ${res.status}: ${res.statusText || "unknown"}`,
        },
        { status: 200 }
      );
    }

    if (result.status === false) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.reason ||
            result.detail ||
            "Fonnte menolak permintaan (status false)",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        detail: result.detail ?? result.reason ?? "Pesan tes terkirim",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Timeout: Fonnte tidak merespons dalam 15 detik"
        : error instanceof Error
          ? error.message
          : String(error);
    return NextResponse.json(
      { success: false, error: `Koneksi gagal: ${message}` },
      { status: 200 }
    );
  } finally {
    clearTimeout(timer);
  }
});
