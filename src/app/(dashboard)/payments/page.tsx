import type { Metadata } from "next";
import Link from "next/link";
import { Plus, FileSpreadsheet, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentTable } from "@/components/tables/payment-table";
import { PaymentFilters } from "@/components/tables/payment-filters";
import { MarkOverdueButton } from "@/components/dialogs/mark-overdue-button";
import { BulkRemindButton } from "@/components/dialogs/bulk-remind-button";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { eq, gte, lte, type SQL } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Pembayaran",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function PaymentsPage({ searchParams }: Props) {
  const params = await searchParams;

  const whereConditions: SQL[] = [];
  if (params.periodMonth) whereConditions.push(eq(payments.periodMonth, params.periodMonth));
  if (params.status) whereConditions.push(eq(payments.status, params.status as "paid" | "pending" | "overdue" | "cancelled"));
  if (params.paymentMethod) whereConditions.push(eq(payments.paymentMethod, params.paymentMethod));
  if (params.dateFrom) whereConditions.push(gte(payments.paymentDate, params.dateFrom));
  if (params.dateTo) whereConditions.push(lte(payments.paymentDate, params.dateTo));

  const data = await db.query.payments.findMany({
    where: (_payments, { and }) => and(...whereConditions),
    with: {
      customer: { columns: { id: true, name: true, customerId: true } },
    },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  const rows = data.map((p) => ({
    id: p.id,
    invoiceNumber: p.invoiceNumber,
    customerName: p.customer.name,
    amount: Number(p.amount),
    paymentDate: p.paymentDate,
    paymentMethod: p.paymentMethod as "cash" | "transfer" | "qris",
    periodMonth: p.periodMonth,
    status: p.status,
  }));

  // Build export URL with current filters
  const exportParams = new URLSearchParams();
  if (params.periodMonth) exportParams.set("periodMonth", params.periodMonth);
  if (params.status) exportParams.set("status", params.status);
  if (params.paymentMethod) exportParams.set("paymentMethod", params.paymentMethod);
  if (params.dateFrom) exportParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) exportParams.set("dateTo", params.dateTo);
  const exportUrl = `/api/payments/export${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pembayaran</h1>
          <p className="text-muted-foreground">
            Catat dan kelola pembayaran pelanggan
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/payments/generate" />}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Generate Tagihan
          </Button>
          <Button render={<Link href="/payments/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            Catat Pembayaran
          </Button>
        </div>
      </div>

      <PaymentFilters />

      <div className="flex justify-end gap-2">
        <BulkRemindButton periodMonth={params.periodMonth} />
        <MarkOverdueButton />
        <Button
          variant="outline"
          size="sm"
          render={
            <a href={exportUrl} download>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export CSV
            </a>
          }
        />
      </div>

      <PaymentTable data={rows} />
    </div>
  );
}
