import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { getBillingConfig } from "@/lib/settings";
import {
  enqueueWhatsAppBilling,
  enqueueWhatsAppOverdueReminder,
} from "@/lib/queue/producer";

export const POST = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  const session = await requireRole(["admin", "operator"]);

  const { id } = await params;
  const paymentId = parseInt(id);
  if (isNaN(paymentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: { customer: { columns: { name: true, phone: true } } },
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.status !== "pending" && payment.status !== "overdue") {
    return NextResponse.json(
      { error: "Pengingat hanya bisa dikirim untuk tagihan yang belum dibayar" },
      { status: 400 }
    );
  }

  if (!payment.customer.phone) {
    return NextResponse.json(
      { error: "Pelanggan tidak memiliki nomor telepon" },
      { status: 400 }
    );
  }

  // Enqueue and return immediately — same as bulk-remind. Calling Fonnte inline
  // held the HTTP request open across an external call; on this box's flaky
  // uplink the Cloudflare tunnel dropped the in-flight request and the browser
  // got an HTML 502. The worker now owns the send: it treats `status:false` as a
  // failure and BullMQ retries, so a queued reminder isn't silently lost.
  const { dueDay } = await getBillingConfig();
  const triggeredBy = parseInt(session.user.id);

  const baseJob = {
    customerPhone: payment.customer.phone,
    customerName: payment.customer.name,
    invoiceNumber: payment.invoiceNumber,
    amount: Number(payment.amount),
    periodMonth: payment.periodMonth,
    triggeredBy,
  };

  if (payment.status === "overdue") {
    await enqueueWhatsAppOverdueReminder({ ...baseJob, dueDay });
  } else {
    await enqueueWhatsAppBilling(baseJob);
  }

  // 202: accepted for async delivery, not yet confirmed sent.
  return NextResponse.json(
    {
      message: `Pengingat tagihan untuk ${payment.customer.name} sedang dikirim`,
    },
    { status: 202 }
  );
});
