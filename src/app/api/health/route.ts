import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { redisConnection } from "@/lib/queue/connection";

export const dynamic = "force-dynamic";

async function checkDb(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - start) };
  }
}

async function checkRedis(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    await redisConnection.ping();
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - start) };
  }
}

export async function GET(req: NextRequest) {
  const detail = req.nextUrl.searchParams.get("detail") === "true";

  const [dbCheck, redisCheck] = await Promise.all([checkDb(), checkRedis()]);
  const healthy = dbCheck.ok;
  const timestamp = new Date().toISOString();

  if (!detail) {
    return NextResponse.json(
      { status: healthy ? "healthy" : "unhealthy", timestamp },
      { status: healthy ? 200 : 503 }
    );
  }

  const mem = process.memoryUsage();

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      timestamp,
      uptime: Math.round(process.uptime()),
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      },
      services: {
        postgres: dbCheck,
        redis: redisCheck,
      },
      node: process.version,
    },
    { status: healthy ? 200 : 503 }
  );
}
