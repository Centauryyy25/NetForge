import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { getBillingConfig } from "@/lib/settings";
import { generateReceiptPdf, amountToWords } from "@/lib/pdf/generate-receipt";
import type { ReceiptData } from "@/lib/pdf/receipt-template";
import { formatDateShort } from "@/lib/utils";
import { buildPaymentConfirmationMessage } from "@/lib/billing/messages";
import { sendWhatsApp, sendWhatsAppDocument } from "@/lib/whatsapp";
import { enqueueWhatsAppReceipt } from "@/lib/queue/producer";
import { apiLogger } from "@/lib/logger";

/** Load a payment with the relations needed to render a receipt. */
export async function loadReceiptPayment(paymentId: number) {
  return db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: {
      customer: { with: { package: true } },
      receiver: { columns: { name: true } },
    },
  });
}

type ReceiptPayment = NonNullable<Awaited<ReturnType<typeof loadReceiptPayment>>>;
type Billing = Awaited<ReturnType<typeof getBillingConfig>>;

/** Assemble the ReceiptData passed to the PDF template. */
export function buildReceiptData(payment: ReceiptPayment, billing: Billing): ReceiptData {
  const amount = Number(payment.amount);
  return {
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
  };
}

/**
 * After a payment is marked paid, enqueue the WhatsApp confirmation + receipt.
 * Thin on purpose: the heavy work (loading the payment, rendering the PDF,
 * calling Fonnte) runs in the worker via {@link deliverPaidNotification}.
 * Generating the PDF inline held the web request open across CPU-heavy
 * rendering — which the Cloudflare tunnel 502s on this low-RAM box.
 *
 * Best-effort: failures here must not break the payment flow, so callers do
 * not need to await-throw on it.
 */
export async function enqueuePaidNotification(
  paymentId: number,
  triggeredBy?: number
): Promise<void> {
  await enqueueWhatsAppReceipt({ paymentId, triggeredBy });
}

/**
 * Worker-side delivery of the paid notification: render the receipt PDF and
 * send it to the customer with a confirmation caption. Falls back to a plain
 * text confirmation if PDF rendering fails. No-op if the customer has no phone.
 *
 * Throws on a Fonnte send failure so BullMQ retries the job.
 */
export async function deliverPaidNotification(paymentId: number) {
  const payment = await loadReceiptPayment(paymentId);
  if (!payment || !payment.customer.phone) {
    return { skipped: true as const };
  }

  const billing = await getBillingConfig();
  const caption = buildPaymentConfirmationMessage({
    customerName: payment.customer.name,
    invoiceNumber: payment.invoiceNumber,
    amount: Number(payment.amount),
    periodMonth: payment.periodMonth,
    companyName: billing.companyName,
    paymentMethod: payment.paymentMethod,
  });

  let pdf: Buffer | null = null;
  try {
    pdf = await generateReceiptPdf(buildReceiptData(payment, billing));
  } catch (err) {
    apiLogger.warn(
      { err, paymentId },
      "receipt PDF generation failed; sending text-only confirmation"
    );
  }

  if (pdf) {
    return sendWhatsAppDocument(
      payment.customer.phone,
      caption,
      pdf,
      `kwitansi-${payment.invoiceNumber}.pdf`
    );
  }
  return sendWhatsApp(payment.customer.phone, caption);
}
