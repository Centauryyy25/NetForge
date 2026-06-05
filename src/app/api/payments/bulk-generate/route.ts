import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { customers } from "@/db/schema/customers";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { nextInvoiceNumber } from "@/lib/ids";
import { enqueueWhatsAppBilling } from "@/lib/queue/producer";

const bulkGenerateSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
  sendReminders: z.boolean().default(false),
});

export const POST = withErrorHandler(async (req) => {
  const session = await requireRole(["admin", "operator"]);

  const body = await req.json();
  const result = bulkGenerateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const { periodMonth, sendReminders } = result.data;
  const userId = parseInt(session.user.id);

  // Get all active customers with their packages
  const activeCustomers = await db.query.customers.findMany({
    where: eq(customers.status, "active"),
    with: { package: true },
  });

  if (activeCustomers.length === 0) {
    return NextResponse.json({
      data: { created: 0, skipped: 0, total: 0 },
    });
  }

  // Find customers who already have an invoice for this period
  const existingPayments = await db.query.payments.findMany({
    where: and(
      eq(payments.periodMonth, periodMonth),
      inArray(
        payments.customerId,
        activeCustomers.map((c) => c.id)
      )
    ),
    columns: { customerId: true },
  });

  const existingCustomerIds = new Set(existingPayments.map((p) => p.customerId));

  // Filter out customers who already have invoices
  const customersToGenerate = activeCustomers.filter(
    (c) => !existingCustomerIds.has(c.id)
  );

  const today = new Date().toISOString().split("T")[0];

  // Generate invoices one by one (invoice number generation is sequential)
  for (const customer of customersToGenerate) {
    const invoiceNumber = await nextInvoiceNumber();
    const amount = customer.package?.price ?? "0";

    await db.insert(payments).values({
      invoiceNumber,
      customerId: customer.id,
      amount,
      paymentDate: today,
      paymentMethod: "",
      periodMonth,
      status: "pending",
      generatedBy: "bulk",
      notes: null,
      receivedBy: userId,
    });

    if (sendReminders && customer.phone) {
      await enqueueWhatsAppBilling({
        customerPhone: customer.phone,
        customerName: customer.name,
        invoiceNumber,
        amount: Number(amount),
        periodMonth,
        triggeredBy: userId,
      });
    }
  }

  return NextResponse.json({
    data: {
      created: customersToGenerate.length,
      skipped: existingCustomerIds.size,
      total: activeCustomers.length,
    },
  });
});
