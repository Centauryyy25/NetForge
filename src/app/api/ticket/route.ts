import { NextResponse } from "next/server";
import { db } from "@/db";
import { serviceRequests } from "@/db/schema/service-requests";
import { createServiceRequestSchema } from "@/validators/service-request";
import { auth } from "@/lib/auth";
import { nextTicketNumber } from "@/lib/ids";
import { calculateSlaDeadline } from "@/lib/sla";
import { logTicketAction } from "@/lib/ticket-log";
import type { TicketPriority } from "@/lib/constants";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await db.query.serviceRequests.findMany({
      with: {
        customer: { columns: { id: true, name: true, customerId: true } },
        handler: { columns: { id: true, name: true } },
      },
      orderBy: (serviceRequests, { desc }) => [desc(serviceRequests.createdAt)],
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/service-requests error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = createServiceRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation Error", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;
    const ticketNumber = await nextTicketNumber();
    const priority = (data.priority ?? "medium") as TicketPriority;
    const now = new Date();
    const slaDeadline = calculateSlaDeadline(now, priority);

    const newRequest = await db
      .insert(serviceRequests)
      .values({
        ticketNumber,
        subject: data.subject,
        type: data.type,
        customerId: data.customerId ?? null,
        name: data.name,
        phone: data.phone,
        description: data.description,
        status: "open",
        priority,
        slaDeadline,
      })
      .returning();

    await logTicketAction({
      ticketId: newRequest[0].id,
      userId: parseInt(session.user.id),
      action: "created",
      detail: `Tiket dibuat: ${data.subject}`,
      newValue: "open",
    });

    return NextResponse.json({ data: newRequest[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-requests error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
