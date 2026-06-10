import { NextResponse } from "next/server";
import { Job } from "bullmq";
import { auth } from "@/lib/auth";
import { mikrotikQueue } from "@/lib/queue/producer";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const job = await Job.fromId(mikrotikQueue, id);

    if (!job) {
      return NextResponse.json(
        { id, state: "unknown", progress: 0 },
        { status: 200 }
      );
    }

    const state = await job.getState();

    return NextResponse.json({
      id: job.id,
      state,
      progress: job.progress ?? 0,
      result: job.returnvalue ?? null,
      error: job.failedReason ?? null,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
