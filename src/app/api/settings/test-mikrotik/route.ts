import { NextResponse } from "next/server";
import { RouterOSAPI } from "node-routeros";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";

export const POST = withErrorHandler(async (req) => {
  await requireRole(["admin"]);

  const { host, port, user, password } = await req.json();

  if (!host || !user) {
    return NextResponse.json(
      { error: "Host dan user wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const conn = new RouterOSAPI({
      host,
      port: Number(port) || 8728,
      user,
      password,
      timeout: 10,
    });

    await conn.connect();
    const identity = await conn.write("/system/identity/print");
    const resource = await conn.write("/system/resource/print");
    conn.close();

    return NextResponse.json({
      success: true,
      data: {
        identity: identity[0]?.name ?? "Unknown",
        cpuLoad: resource[0]?.["cpu-load"] ?? "-",
        uptime: resource[0]?.uptime ?? "-",
        version: resource[0]?.version ?? "-",
        boardName: resource[0]?.["board-name"] ?? "-",
        totalMemory: resource[0]?.["total-memory"] ?? "-",
        freeMemory: resource[0]?.["free-memory"] ?? "-",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Koneksi gagal: ${message}` },
      { status: 200 }
    );
  }
});
