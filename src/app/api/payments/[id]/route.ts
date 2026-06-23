import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { enqueuePaidNotification } from "@/lib/billing/receipt";
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
  const session = await requireRole(["admin", "operator"]);

  const { id } = await params;
  const paymentId = parseInt(id);
  if (isNaN(paymentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const existing = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
  });
  if (!existing) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const body = await req.json();
  const { status, paymentMethod, paymentDate, notes } = body;

  // Prevent reverting paid status
  if (existing.status === "paid" && status && status !== "paid") {
    return NextResponse.json(
      { error: "Pembayaran yang sudah lunas tidak bisa diubah statusnya" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (paymentMethod) updateData.paymentMethod = paymentMethod;
  if (paymentDate) updateData.paymentDate = paymentDate;

  // Set paidAt when marking as paid
  if (status === "paid" && existing.status !== "paid") {
    updateData.paidAt = new Date();
  }

  const updated = await db
    .update(payments)
    .set(updateData)
    .where(eq(payments.id, paymentId))
    .returning();

  // On transition to paid, auto-send WhatsApp confirmation + receipt PDF.
  if (status === "paid" && existing.status !== "paid") {
    await enqueuePaidNotification(paymentId, parseInt(session.user.id));
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
