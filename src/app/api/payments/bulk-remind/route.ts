import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { getBillingConfig } from "@/lib/settings";
import {
  enqueueWhatsAppBilling,
  enqueueWhatsAppOverdueReminder,
} from "@/lib/queue/producer";

const bulkRemindSchema = z.object({
  periodMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM")
    .optional(),
});

export const POST = withErrorHandler(async (req) => {
  const session = await requireRole(["admin", "operator"]);

  const body = await req.json().catch(() => ({}));
  const result = bulkRemindSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const { periodMonth } = result.data;
  const triggeredBy = parseInt(session.user.id);

  const conditions: SQL[] = [
    inArray(payments.status, ["pending", "overdue"]),
  ];
  if (periodMonth) conditions.push(eq(payments.periodMonth, periodMonth));

  const unpaid = await db.query.payments.findMany({
    where: and(...conditions),
    with: { customer: { columns: { name: true, phone: true } } },
  });

  const { dueDay } = await getBillingConfig();

  let sent = 0;
  let skipped = 0;

  for (const payment of unpaid) {
    if (!payment.customer.phone) {
      skipped++;
      continue;
    }

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
    sent++;
  }

  return NextResponse.json({
    data: { sent, skipped },
    message:
      sent === 0
        ? "Tidak ada tagihan belum bayar untuk ditagih"
        : `${sent} pengingat tagihan dikirim${skipped ? `, ${skipped} dilewati (tanpa nomor)` : ""}`,
  });
});
