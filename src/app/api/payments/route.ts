import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { customers } from "@/db/schema/customers";
import { createPaymentSchema } from "@/validators/payment";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { nextInvoiceNumber } from "@/lib/ids";
import { enqueueWhatsAppBilling } from "@/lib/queue/producer";
import { eq, gte, lte, type SQL } from "drizzle-orm";

export const GET = withErrorHandler(async (req) => {
  await requireAuth();

  const { searchParams } = new URL(req.url);
  const periodMonth = searchParams.get("periodMonth");
  const customerId = searchParams.get("customerId");
  const status = searchParams.get("status");
  const paymentMethod = searchParams.get("paymentMethod");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const whereConditions: SQL[] = [];
  if (periodMonth) whereConditions.push(eq(payments.periodMonth, periodMonth));
  if (customerId && !isNaN(parseInt(customerId))) {
    whereConditions.push(eq(payments.customerId, parseInt(customerId)));
  }
  if (status) whereConditions.push(eq(payments.status, status as "paid" | "pending" | "overdue" | "cancelled"));
  if (paymentMethod) whereConditions.push(eq(payments.paymentMethod, paymentMethod));
  if (dateFrom) whereConditions.push(gte(payments.paymentDate, dateFrom));
  if (dateTo) whereConditions.push(lte(payments.paymentDate, dateTo));

  const data = await db.query.payments.findMany({
    where: (_payments, { and }) => and(...whereConditions),
    with: {
      customer: true,
      receiver: { columns: { id: true, name: true } },
    },
    orderBy: (payments, { desc }) => [desc(payments.paymentDate)],
  });

  return NextResponse.json({ data });
});

export const POST = withErrorHandler(async (req) => {
  const session = await requireRole(["admin", "operator"]);

  const body = await req.json();
  const result = createPaymentSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const data = result.data;

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, data.customerId),
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const invoiceNumber = await nextInvoiceNumber();

  const newPayment = await db
    .insert(payments)
    .values({
      invoiceNumber,
      customerId: data.customerId,
      amount: data.amount.toString(),
      paymentDate: data.paymentDate,
      paymentMethod: data.paymentMethod,
      periodMonth: data.periodMonth,
      status: "paid",
      notes: data.notes || null,
      receivedBy: parseInt(session.user.id),
    })
    .returning();

  await enqueueWhatsAppBilling({
    customerPhone: customer.phone,
    customerName: customer.name,
    invoiceNumber,
    amount: data.amount,
    periodMonth: data.periodMonth,
    triggeredBy: parseInt(session.user.id),
  });

  return NextResponse.json({ data: newPayment[0] }, { status: 201 });
});
