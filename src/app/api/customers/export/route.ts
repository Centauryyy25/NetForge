import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { customers } from "@/db/schema/customers";
import { eq } from "drizzle-orm";
import { CUSTOMER_STATUS_LABELS, type CustomerStatus } from "@/lib/constants";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET = withErrorHandler(async (req) => {
  await requireRole(["admin", "operator"]);

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") as CustomerStatus | null;

  const data = await db.query.customers.findMany({
    with: { package: true },
    ...(statusFilter ? { where: eq(customers.status, statusFilter) } : {}),
    orderBy: (c, { asc }) => [asc(c.customerId)],
  });

  const headers = [
    "ID Pelanggan",
    "Nama",
    "Alamat",
    "Telepon",
    "Email",
    "NIK",
    "Paket",
    "Kecepatan (Mbps)",
    "Harga",
    "Status",
    "PPPoE Username",
    "ONU S/N",
    "Terdaftar",
    "Aktif Sampai",
  ];

  const rows = data.map((c) => [
    c.customerId,
    c.name,
    c.address,
    c.phone,
    c.email ?? "",
    c.nik ?? "",
    c.package?.name ?? "",
    String(c.package?.speed ?? ""),
    String(c.package?.price ?? ""),
    CUSTOMER_STATUS_LABELS[c.status] ?? c.status,
    c.pppoeUsername ?? "",
    c.onuSn ?? "",
    c.registrationDate,
    c.activeUntil,
  ]);

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");

  const today = new Date().toISOString().split("T")[0];

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pelanggan-ybynet-${today}.csv"`,
    },
  });
});
