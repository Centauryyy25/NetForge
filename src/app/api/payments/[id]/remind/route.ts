import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { getBillingConfig } from "@/lib/settings";
import { sendWhatsApp } from "@/lib/whatsapp";
import {
  buildBillingMessage,
  buildOverdueMessage,
} from "@/lib/billing/messages";

export const POST = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  await requireRole(["admin", "operator"]);

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

  // Send synchronously so the operator gets the real Fonnte result immediately
  // (success or the actual rejection reason), like the /settings test. Bulk and
  // generate paths stay async via the queue.
  const { companyName } = await getBillingConfig();
  const messageParams = {
    customerName: payment.customer.name,
    invoiceNumber: payment.invoiceNumber,
    amount: Number(payment.amount),
    periodMonth: payment.periodMonth,
    companyName,
  };
  const message =
    payment.status === "overdue"
      ? buildOverdueMessage(messageParams)
      : buildBillingMessage(messageParams);

  try {
    await sendWhatsApp(payment.customer.phone, message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Gagal mengirim pengingat: ${reason}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    message: `Pengingat tagihan dikirim ke ${payment.customer.name}`,
  });
});
