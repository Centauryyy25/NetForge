import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, payments, serviceRequests } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [
      totalCustomers,
      activeCustomers,
      suspendedCustomers,
      monthlyRevenueResult,
      pendingPayments,
      overduePayments,
      openTickets,
      statusDistribution,
      monthlyRevenueData,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(customers),
      db.select({ count: sql<number>`count(*)::int` }).from(customers).where(eq(customers.status, "active")),
      db.select({ count: sql<number>`count(*)::int` }).from(customers).where(eq(customers.status, "suspended")),
      db.select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::numeric` }).from(payments).where(and(eq(payments.status, "paid"), eq(payments.periodMonth, currentMonth))),
      db.select({ count: sql<number>`count(*)::int` }).from(payments).where(eq(payments.status, "pending")),
      db.select({ count: sql<number>`count(*)::int` }).from(payments).where(eq(payments.status, "overdue")),
      db.select({ count: sql<number>`count(*)::int` }).from(serviceRequests).where(eq(serviceRequests.status, "open")),
      db.select({
        status: customers.status,
        count: sql<number>`count(*)::int`,
      }).from(customers).groupBy(customers.status),
      db.select({
        month: payments.periodMonth,
        revenue: sql<number>`sum(${payments.amount})::numeric`,
      })
        .from(payments)
        .where(eq(payments.status, "paid"))
        .groupBy(payments.periodMonth)
        .orderBy(payments.periodMonth)
        .limit(12),
    ]);

    const stats = {
      totalCustomers: totalCustomers[0].count,
      activeCustomers: activeCustomers[0].count,
      suspendedCustomers: suspendedCustomers[0].count,
      monthlyRevenue: Number(monthlyRevenueResult[0].total),
      pendingPayments: pendingPayments[0].count,
      overduePayments: overduePayments[0].count,
      openTickets: openTickets[0].count,
      statusDistribution,
    };

    const revenueData = monthlyRevenueData.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
    }));

    return NextResponse.json({
      data: {
        stats,
        revenueData,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
