import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { requireAuth } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { getBillingConfig } from "@/lib/settings";
import { generateReceiptPdf, amountToWords } from "@/lib/pdf/generate-receipt";
import { formatDateShort } from "@/lib/utils";

export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  await requireAuth();

  const { id } = await params;
  const paymentId = parseInt(id);
  if (isNaN(paymentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: {
      customer: {
        with: { package: true },
      },
      receiver: { columns: { name: true } },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const billing = await getBillingConfig();
  const amount = Number(payment.amount);

  const pdfBuffer = await generateReceiptPdf({
    invoiceNumber: payment.invoiceNumber,
    periodMonth: payment.periodMonth,
    amount,
    amountInWords: amountToWords(amount),
    paymentMethod: payment.paymentMethod,
    paymentDate: payment.paymentDate ? formatDateShort(payment.paymentDate) : "-",
    paidAt: payment.paidAt ? formatDateShort(payment.paidAt) : null,
    customerName: payment.customer.name,
    customerId: payment.customer.customerId,
    customerAddress: payment.customer.address || "",
    customerPhone: payment.customer.phone,
    packageName: payment.customer.package?.name || "-",
    packagePrice: Number(payment.customer.package?.price || 0),
    operatorName: payment.receiver?.name || "-",
    companyName: billing.companyName,
    companyAddress: billing.companyAddress,
    companyPhone: billing.companyPhone,
    status: payment.status,
  });

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kwitansi-${payment.invoiceNumber}.pdf"`,
    },
  });
});
