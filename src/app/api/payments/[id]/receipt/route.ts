import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { getBillingConfig } from "@/lib/settings";
import { generateReceiptPdf } from "@/lib/pdf/generate-receipt";
import { loadReceiptPayment, buildReceiptData } from "@/lib/billing/receipt";

export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  await requireAuth();

  const { id } = await params;
  const paymentId = parseInt(id);
  if (isNaN(paymentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const payment = await loadReceiptPayment(paymentId);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const billing = await getBillingConfig();
  const pdfBuffer = await generateReceiptPdf(buildReceiptData(payment, billing));

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kwitansi-${payment.invoiceNumber}.pdf"`,
    },
  });
});
