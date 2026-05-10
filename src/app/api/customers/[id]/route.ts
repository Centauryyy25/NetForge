import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema/customers";
import { packages } from "@/db/schema/packages";
import { updateCustomerSchema } from "@/validators/customer";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { eq } from "drizzle-orm";
import {
  enqueueSuspendPPPoE,
  enqueueActivatePPPoE,
  enqueueSetQueue,
} from "@/lib/queue/producer";

export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  await requireAuth();

  const { id: rawId } = await params;
  const id = parseInt(rawId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, id),
    with: {
      package: true,
      payments: { orderBy: (payments, { desc }) => [desc(payments.paymentDate)] },
      activityLogs: { orderBy: (logs, { desc }) => [desc(logs.timestamp)], limit: 50 },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ data: customer });
});

export const PATCH = withErrorHandler<{ id: string }>(async (req, { params }) => {
  await requireRole(["admin", "operator"]);

  const { id: rawId } = await params;
  const id = parseInt(rawId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const body = await req.json();
  const result = updateCustomerSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const exCustomer = await db.query.customers.findFirst({
    where: eq(customers.id, id),
  });
  if (!exCustomer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db
    .update(customers)
    .set({
      ...result.data,
      email: result.data.email || null,
      nik: result.data.nik || null,
      pppoeUsername: result.data.pppoeUsername || null,
      onuSn: result.data.onuSn || null,
      notes: result.data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id))
    .returning();

  let jobId: string | null = null;
  const pppoeUser = result.data.pppoeUsername ?? exCustomer.pppoeUsername;

  const newStatus = result.data.status;
  if (newStatus && newStatus !== exCustomer.status && pppoeUser) {
    if (newStatus === "suspended" || newStatus === "terminated") {
      const job = await enqueueSuspendPPPoE({ username: pppoeUser });
      jobId = job.id ?? null;
    } else if (newStatus === "active") {
      const job = await enqueueActivatePPPoE({ username: pppoeUser });
      jobId = job.id ?? null;
    }
  }

  const newPackageId = result.data.packageId;
  if (newPackageId && newPackageId !== exCustomer.packageId && pppoeUser) {
    const newPkg = await db.query.packages.findFirst({
      where: eq(packages.id, newPackageId),
    });
    if (newPkg) {
      const maxLimit = newPkg.queueTarget || `${newPkg.speed}M/${newPkg.speed}M`;
      const queueJob = await enqueueSetQueue({
        name: pppoeUser,
        target: pppoeUser,
        maxLimit,
      });
      if (!jobId) jobId = queueJob.id ?? null;
    }
  }

  return NextResponse.json({ data: updated[0], jobId });
});

export const DELETE = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  await requireRole(["admin"]);

  const { id: rawId } = await params;
  const id = parseInt(rawId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const deleted = await db
      .delete(customers)
      .where(eq(customers.id, id))
      .returning();

    if (!deleted.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted[0] });
  } catch {
    return NextResponse.json(
      {
        error:
          "Cannot delete customer because of existing relations (payments/logs).",
      },
      { status: 409 }
    );
  }
});
