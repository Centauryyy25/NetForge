import { NextResponse } from "next/server";
import { db } from "@/db";
import { serviceRequests } from "@/db/schema/service-requests";
import { updateServiceRequestSchema } from "@/validators/service-request";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { calculateSlaDeadline, extendDeadlineAfterPause } from "@/lib/sla";
import { logTicketAction } from "@/lib/ticket-log";
import type { TicketPriority, Role } from "@/lib/constants";

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
    const requestId = parseInt(id);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const data = await db.query.serviceRequests.findFirst({
      where: eq(serviceRequests.id, requestId),
      with: {
        customer: true,
        handler: { columns: { id: true, name: true } },
      },
    });

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/service-requests/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const requestId = parseInt(id);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const result = updateServiceRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation Error", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;

    // Fetch current ticket state for status transition logic
    const ticket = await db.query.serviceRequests.findFirst({
      where: eq(serviceRequests.id, requestId),
    });
    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.status) {
      updateData.status = data.status;

      // --- SLA pause/resume ---
      // Entering pending: freeze SLA clock
      if (data.status === "pending" && ticket.status !== "pending") {
        updateData.slaPausedAt = new Date();
      }
      // Leaving pending: extend deadline by paused duration, clear pause marker
      if (data.status !== "pending" && ticket.status === "pending") {
        updateData.slaDeadline = extendDeadlineAfterPause(ticket.slaDeadline, ticket.slaPausedAt);
        updateData.slaPausedAt = null;
      }

      if (data.status === "resolved" || data.status === "closed") {
        updateData.resolvedAt = new Date();
        // If closing from pending, also clear pause
        if (ticket.status === "pending") {
          updateData.slaPausedAt = null;
        }
      }
      // Assign handler when status moves to in_progress
      if (data.status === "in_progress" || data.status === "approved") {
        updateData.handledBy = parseInt(session.user.id);
      }
    }

    if (data.priority) {
      updateData.priority = data.priority;
      // Recalculate SLA from ticket's createdAt (only if not paused)
      if (ticket.status !== "pending") {
        updateData.slaDeadline = calculateSlaDeadline(ticket.createdAt, data.priority as TicketPriority);
      }
    }

    if (data.adminNotes !== undefined) {
      updateData.adminNotes = data.adminNotes;
    }

    const updated = await db
      .update(serviceRequests)
      .set(updateData)
      .where(eq(serviceRequests.id, requestId))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Log changes to ticket_logs
    const userId = parseInt(session.user.id);
    if (data.status && data.status !== ticket.status) {
      await logTicketAction({
        ticketId: requestId,
        userId,
        action: "status_change",
        detail: `Status diubah dari "${ticket.status}" ke "${data.status}"`,
        oldValue: ticket.status,
        newValue: data.status,
      });
    }
    if (data.priority && data.priority !== ticket.priority) {
      await logTicketAction({
        ticketId: requestId,
        userId,
        action: "priority_change",
        detail: `Prioritas diubah dari "${ticket.priority}" ke "${data.priority}"`,
        oldValue: ticket.priority,
        newValue: data.priority,
      });
    }
    if (data.adminNotes !== undefined && data.adminNotes !== ticket.adminNotes) {
      await logTicketAction({
        ticketId: requestId,
        userId,
        action: "note_update",
        detail: data.adminNotes || "(catatan dikosongkan)",
        oldValue: ticket.adminNotes?.slice(0, 100) ?? null,
        newValue: data.adminNotes?.slice(0, 100) ?? null,
      });
    }

    return NextResponse.json({ data: updated[0] });
  } catch (error) {
    console.error("PATCH /api/ticket/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as Role;
    if (role !== "admin") {
      return NextResponse.json({ error: "Hanya admin yang dapat menghapus tiket" }, { status: 403 });
    }

    const { id } = await params;
    const ticketId = parseInt(id);
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const deleted = await db
      .delete(serviceRequests)
      .where(eq(serviceRequests.id, ticketId))
      .returning();

    if (!deleted.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Tiket berhasil dihapus" });
  } catch (error) {
    console.error("DELETE /api/ticket/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
