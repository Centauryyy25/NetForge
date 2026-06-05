import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { getBillingConfig } from "@/lib/settings";
import { enqueueWhatsAppOverdueReminder } from "@/lib/queue/producer";

/**
 * Mark pending payments as overdue if the due date has passed.
 * Returns the count of payments updated.
 */
export async function markOverduePayments(): Promise<number> {
  const { dueDay } = await getBillingConfig();

  // Find all pending payments
  const pendingPayments = await db.query.payments.findMany({
    where: eq(payments.status, "pending"),
    with: {
      customer: { columns: { phone: true, name: true } },
    },
  });

  const now = new Date();
  let updatedCount = 0;

  for (const payment of pendingPayments) {
    // Calculate due date from periodMonth + dueDay
    // periodMonth is "YYYY-MM", due date is YYYY-MM-{dueDay}
    const [year, month] = payment.periodMonth.split("-").map(Number);
    const dueDate = new Date(year, month - 1, dueDay, 23, 59, 59);

    if (now > dueDate) {
      await db
        .update(payments)
        .set({ status: "overdue" })
        .where(
          and(eq(payments.id, payment.id), eq(payments.status, "pending"))
        );

      updatedCount++;

      // Enqueue overdue reminder
      if (payment.customer.phone) {
        await enqueueWhatsAppOverdueReminder({
          customerPhone: payment.customer.phone,
          customerName: payment.customer.name,
          invoiceNumber: payment.invoiceNumber,
          amount: Number(payment.amount),
          periodMonth: payment.periodMonth,
          dueDay,
        });
      }
    }
  }

  return updatedCount;
}
