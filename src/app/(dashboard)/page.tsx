import type { Metadata } from "next";
import {
  Users,
  UserCheck,
  UserX,
  CreditCard,
  AlertCircle,
  TicketCheck,
  Wifi,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { CustomerStatusChart } from "@/components/charts/customer-status-chart";
import { db } from "@/db";
import { customers, payments, serviceRequests } from "@/db/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { formatRupiah } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

async function getDashboardStats() {
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
  ]);

  return {
    totalCustomers: totalCustomers[0].count,
    activeCustomers: activeCustomers[0].count,
    suspendedCustomers: suspendedCustomers[0].count,
    monthlyRevenue: Number(monthlyRevenueResult[0].total),
    pendingPayments: pendingPayments[0].count,
    overduePayments: overduePayments[0].count,
    openTickets: openTickets[0].count,
    statusDistribution,
  };
}

async function getMonthlyRevenue() {
  const result = await db.select({
    month: payments.periodMonth,
    revenue: sql<number>`sum(${payments.amount})::numeric`,
  })
    .from(payments)
    .where(eq(payments.status, "paid"))
    .groupBy(payments.periodMonth)
    .orderBy(payments.periodMonth)
    .limit(12);

  return result.map((r) => ({
    month: r.month,
    revenue: Number(r.revenue),
  }));
}

export default async function DashboardPage() {
  const [stats, revenueData] = await Promise.all([
    getDashboardStats(),
    getMonthlyRevenue(),
  ]);

  const statCards = [
    {
      title: "Total Pelanggan",
      value: stats.totalCustomers,
      icon: Users,
      description: "Semua pelanggan terdaftar",
    },
    {
      title: "Pelanggan Aktif",
      value: stats.activeCustomers,
      icon: UserCheck,
      description: `${Math.round((stats.activeCustomers / (stats.totalCustomers || 1)) * 100)}% dari total`,
    },
    {
      title: "Ditangguhkan",
      value: stats.suspendedCustomers,
      icon: UserX,
      description: "Perlu tindak lanjut",
    },
    {
      title: "Pendapatan Bulan Ini",
      value: formatRupiah(stats.monthlyRevenue),
      icon: TrendingUp,
      description: "Total pembayaran lunas",
    },
    {
      title: "Pembayaran Pending",
      value: stats.pendingPayments,
      icon: CreditCard,
      description: "Menunggu konfirmasi",
    },
    {
      title: "Tunggakan",
      value: stats.overduePayments,
      icon: AlertCircle,
      description: "Perlu ditagih",
    },
    {
      title: "Tiket Terbuka",
      value: stats.openTickets,
      icon: TicketCheck,
      description: "Belum ditangani",
    },
    {
      title: "Koneksi Aktif",
      value: stats.activeCustomers,
      icon: Wifi,
      description: "Estimasi PPPoE online",
    },
  ];

  const statusData = stats.statusDistribution.map((s) => ({
    name: s.status,
    value: s.count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Ringkasan operasional YBY NET
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} className="transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle>Pendapatan Bulanan</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3 transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle>Status Pelanggan</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerStatusChart data={statusData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
