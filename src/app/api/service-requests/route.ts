import { NextResponse } from "next/server";
import { db } from "@/db";
import { serviceRequests } from "@/db/schema/service-requests";
import { createServiceRequestSchema } from "@/validators/service-request";
import { auth } from "@/lib/auth";
import { nextTicketNumber } from "@/lib/ids";

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

    const newRequest = await db
      .insert(serviceRequests)
      .values({
        ticketNumber,
        type: data.type,
        customerId: data.customerId ?? null,
        name: data.name,
        phone: data.phone,
        description: data.description,
        status: "open",
      })
      .returning();

    return NextResponse.json({ data: newRequest[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-requests error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
