import type { Metadata } from "next";
import { CustomerForm } from "@/components/forms/customer-form";
import { db } from "@/db";
import { packages } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Tambah Pelanggan",
};

export default async function NewCustomerPage() {
  const pkgs = await db.query.packages.findMany({
    where: eq(packages.isActive, true),
    orderBy: (packages, { asc }) => [asc(packages.speed)],
  });

  const packageOptions = pkgs.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tambah Pelanggan</h1>
        <p className="text-muted-foreground">
          Daftarkan pelanggan baru ke sistem YBY NET
        </p>
      </div>
      <CustomerForm packages={packageOptions} />
    </div>
  );
}
