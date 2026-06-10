import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerTable } from "@/components/tables/customer-table";
import { db } from "@/db";

export const metadata: Metadata = {
  title: "Pelanggan",
};

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const data = await db.query.customers.findMany({
    with: { package: true },
    orderBy: (customers, { desc }) => [desc(customers.createdAt)],
  });

  const rows = data.map((c) => ({
    id: c.id,
    customerId: c.customerId,
    name: c.name,
    phone: c.phone,
    packageName: c.package?.name ?? "-",
    speed: c.package?.speed ?? 0,
    price: Number(c.package?.price ?? 0),
    status: c.status,
    pppoeUsername: c.pppoeUsername ?? "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pelanggan</h1>
          <p className="text-muted-foreground">
            Kelola data pelanggan YBY NET
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<a href="/api/customers/export" download />}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button render={<Link href="/customers/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Pelanggan
          </Button>
        </div>
      </div>
      <CustomerTable data={rows} />
    </div>
  );
}
