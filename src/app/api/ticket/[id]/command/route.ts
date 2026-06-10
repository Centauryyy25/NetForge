import { NextResponse } from "next/server";
import { db } from "@/db";
import { serviceRequests } from "@/db/schema/service-requests";
import { ticketCommandSchema } from "@/validators/service-request";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { calculateSlaDeadline, extendDeadlineAfterPause } from "@/lib/sla";
import type { TicketPriority } from "@/lib/constants";
import { logTicketAction } from "@/lib/ticket-log";

const PRIORITY_ORDER: TicketPriority[] = ["low", "medium", "high", "critical"];

function bumpPriority(current: string): TicketPriority | null {
  const idx = PRIORITY_ORDER.indexOf(current as TicketPriority);
  if (idx === -1 || idx >= PRIORITY_ORDER.length - 1) return null;
  return PRIORITY_ORDER[idx + 1];
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "admin" && role !== "operator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const ticketId = parseInt(id);
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const result = ticketCommandSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation Error", details: result.error.format() },
        { status: 400 }
      );
    }

    const ticket = await db.query.serviceRequests.findFirst({
      where: eq(serviceRequests.id, ticketId),
    });

    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { command, argument } = result.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const userName = session.user.name ?? "System";
    const userId = parseInt(session.user.id);
    let logAction = command;
    let logDetail = "";
    let logOldValue: string | null = null;
    let logNewValue: string | null = null;

    switch (command) {
      case "eskalasi": {
        const newPriority = bumpPriority(ticket.priority);
        if (!newPriority) {
          return NextResponse.json(
            { error: "Sudah prioritas tertinggi (Kritis)" },
            { status: 400 }
          );
        }
        updateData.priority = newPriority;
        updateData.slaDeadline = calculateSlaDeadline(new Date(), newPriority);
        updateData.escalatedAt = new Date();
        logDetail = `Eskalasi prioritas${argument ? `: ${argument}` : ""}`;
        logOldValue = ticket.priority;
        logNewValue = newPriority;
        break;
      }

      case "tutup": {
        updateData.status = "closed";
        updateData.resolvedAt = new Date();
        logDetail = `Tiket ditutup${argument ? `: ${argument}` : ""}`;
        logOldValue = ticket.status;
        logNewValue = "closed";
        break;
      }

      case "tunda": {
        if (ticket.status === "pending") {
          return NextResponse.json(
            { error: "Tiket sudah dalam status Ditunda" },
            { status: 400 }
          );
        }
        updateData.status = "pending";
        updateData.slaPausedAt = new Date();
        logDetail = `Tiket ditunda, SLA dijeda${argument ? `: ${argument}` : ""}`;
        logOldValue = ticket.status;
        logNewValue = "pending";
        break;
      }

      case "lanjut": {
        if (ticket.status !== "pending") {
          return NextResponse.json(
            { error: "Tiket tidak dalam status Ditunda" },
            { status: 400 }
          );
        }
        updateData.status = "in_progress";
        updateData.slaDeadline = extendDeadlineAfterPause(ticket.slaDeadline, ticket.slaPausedAt);
        updateData.slaPausedAt = null;
        logDetail = `Tiket dilanjutkan, SLA dilanjutkan${argument ? `: ${argument}` : ""}`;
        logOldValue = "pending";
        logNewValue = "in_progress";
        break;
      }

      case "gangguan-massal": {
        const tag = argument || "Gangguan Massal";
        updateData.massOutageTag = tag;
        logDetail = `Ditandai gangguan massal: ${tag}`;
        logNewValue = tag;
        break;
      }
    }

    const updated = await db
      .update(serviceRequests)
      .set(updateData)
      .where(eq(serviceRequests.id, ticketId))
      .returning();

    await logTicketAction({
      ticketId,
      userId,
      action: logAction,
      detail: logDetail,
      oldValue: logOldValue,
      newValue: logNewValue,
    });

    return NextResponse.json({ data: updated[0] });
  } catch (error) {
    console.error("POST /api/ticket/[id]/command error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
