import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { requireAuth } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";

interface CustomerReceivable {
  customerId: number;
  customerCode: string;
  customerName: string;
  customerPhone: string;
  periods: { month: string; amount: number; status: string }[];
  totalOutstanding: number;
  agingMonths: number;
}

export const GET = withErrorHandler(async () => {
  await requireAuth();

  // Fetch all pending and overdue payments with customer info
  const outstanding = await db.query.payments.findMany({
    where: (_p, { or }) =>
      or(
        inArray(payments.status, ["pending", "overdue"])
      ),
    with: {
      customer: { columns: { id: true, customerId: true, name: true, phone: true } },
    },
    orderBy: (p, { asc }) => [asc(p.periodMonth)],
  });

  // Group by customer
  const customerMap = new Map<number, CustomerReceivable>();

  for (const p of outstanding) {
    const cId = p.customer.id;
    if (!customerMap.has(cId)) {
      customerMap.set(cId, {
        customerId: cId,
        customerCode: p.customer.customerId,
        customerName: p.customer.name,
        customerPhone: p.customer.phone,
        periods: [],
        totalOutstanding: 0,
        agingMonths: 0,
      });
    }
    const entry = customerMap.get(cId)!;
    entry.periods.push({
      month: p.periodMonth,
      amount: Number(p.amount),
      status: p.status,
    });
    entry.totalOutstanding += Number(p.amount);
  }

  // Calculate aging (number of distinct unpaid months)
  for (const entry of customerMap.values()) {
    entry.agingMonths = entry.periods.length;
  }

  const customers = Array.from(customerMap.values()).sort(
    (a, b) => b.agingMonths - a.agingMonths || b.totalOutstanding - a.totalOutstanding
  );

  // Summary
  let total1Month = 0;
  let total2Months = 0;
  let total3Plus = 0;
  let grandTotal = 0;

  for (const c of customers) {
    grandTotal += c.totalOutstanding;
    if (c.agingMonths === 1) total1Month += c.totalOutstanding;
    else if (c.agingMonths === 2) total2Months += c.totalOutstanding;
    else total3Plus += c.totalOutstanding;
  }

  return NextResponse.json({
    data: {
      customers,
      summary: {
        total1Month,
        total2Months,
        total3Plus,
        grandTotal,
        count1Month: customers.filter((c) => c.agingMonths === 1).length,
        count2Months: customers.filter((c) => c.agingMonths === 2).length,
        count3Plus: customers.filter((c) => c.agingMonths >= 3).length,
      },
    },
  });
});
