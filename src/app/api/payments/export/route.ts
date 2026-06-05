import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { eq, gte, lte, type SQL } from "drizzle-orm";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants";

const METHOD_LABELS: Record<string, string> = {
  cash: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
};

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET = withErrorHandler(async (req) => {
  await requireRole(["admin", "operator"]);

  const { searchParams } = new URL(req.url);
  const periodMonth = searchParams.get("periodMonth");
  const status = searchParams.get("status");
  const paymentMethod = searchParams.get("paymentMethod");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const whereConditions: SQL[] = [];
  if (periodMonth) whereConditions.push(eq(payments.periodMonth, periodMonth));
  if (status) whereConditions.push(eq(payments.status, status as "paid" | "pending" | "overdue" | "cancelled"));
  if (paymentMethod) whereConditions.push(eq(payments.paymentMethod, paymentMethod));
  if (dateFrom) whereConditions.push(gte(payments.paymentDate, dateFrom));
  if (dateTo) whereConditions.push(lte(payments.paymentDate, dateTo));

  const data = await db.query.payments.findMany({
    where: (_payments, { and }) => and(...whereConditions),
    with: {
      customer: { columns: { name: true } },
    },
    orderBy: (payments, { desc }) => [desc(payments.paymentDate)],
  });

  const header = "No Invoice,Pelanggan,Periode,Jumlah,Metode,Tanggal Bayar,Status";
  const rows = data.map((p) =>
    [
      escapeCsv(p.invoiceNumber),
      escapeCsv(p.customer.name),
      p.periodMonth,
      p.amount,
      METHOD_LABELS[p.paymentMethod] || p.paymentMethod,
      p.paymentDate || "",
      PAYMENT_STATUS_LABELS[p.status] || p.status,
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const filename = `pembayaran-${periodMonth || "semua"}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
