import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";

export const POST = withErrorHandler(async (req) => {
  await requireRole(["admin"]);

  const { apiUrl, token, phone } = await req.json();

  if (!apiUrl || !token || !phone) {
    return NextResponse.json(
      { error: "API URL, Token, dan Nomor WA wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        target: phone, 
        message: "Halo! \n\nIni adalah pesan percobaan dari sistem YBY NET.\nJika Anda menerima pesan ini, berarti konfigurasi WhatsApp Gateway Fonnte sudah berhasil." 
      }),
    });

    const data = await res.json();
    
    if (!res.ok || !data.status) {
      throw new Error(data.reason || data.detail || `HTTP ${res.status}`);
    }

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Koneksi gagal: ${message}` },
      { status: 200 }
    );
  }
});
