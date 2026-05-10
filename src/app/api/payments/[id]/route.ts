import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { eq } from "drizzle-orm";

export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  await requireAuth();

  const { id } = await params;
  const paymentId = parseInt(id);
  if (isNaN(paymentId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: { customer: true, receiver: { columns: { name: true } } },
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json({ data: payment });
});

export const PATCH = withErrorHandler<{ id: string }>(async (req, { params }) => {
  await requireRole(["admin", "operator"]);

  const { id } = await params;
  const paymentId = parseInt(id);
  if (isNaN(paymentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();
  const { status, notes } = body;

  const updated = await db
    .update(payments)
    .set({
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
    })
    .where(eq(payments.id, paymentId))
    .returning();

  if (!updated.length) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json({ data: updated[0] });
});

export const DELETE = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  await requireRole(["admin"]);

  const { id } = await params;
  const paymentId = parseInt(id);
  if (isNaN(paymentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const deleted = await db
    .delete(payments)
    .where(eq(payments.id, paymentId))
    .returning();

  if (!deleted.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: deleted[0] });
});
