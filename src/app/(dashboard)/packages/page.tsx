import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PackageTable } from "@/components/tables/package-table";
import { db } from "@/db";
import { packages, customers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Paket Layanan",
};

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const data = await db.query.packages.findMany({
    orderBy: (packages, { asc }) => [asc(packages.speed)],
  });

  // Count customers per package
  const customerCounts = await db
    .select({
      packageId: customers.packageId,
      count: sql<number>`count(*)::int`,
    })
    .from(customers)
    .groupBy(customers.packageId);

  const countMap = new Map(customerCounts.map((c) => [c.packageId, c.count]));

  const rows = data.map((p) => ({
    id: p.id,
    name: p.name,
    speed: p.speed,
    price: Number(p.price),
    queueTarget: p.queueTarget,
    isActive: p.isActive,
    customerCount: countMap.get(p.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paket Layanan</h1>
          <p className="text-muted-foreground">
            Kelola paket internet yang tersedia
          </p>
        </div>
        <Button render={<Link href="/packages/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Paket
        </Button>
      </div>
      <PackageTable data={rows} />
    </div>
  );
}
