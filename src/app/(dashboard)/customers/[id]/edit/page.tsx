import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/forms/customer-form";
import { db } from "@/db";
import { customers, packages } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Edit Pelanggan",
};

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customerId = parseInt(id);
  if (isNaN(customerId)) notFound();

  const [customer, pkgs] = await Promise.all([
    db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    }),
    db.query.packages.findMany({
      where: eq(packages.isActive, true),
      orderBy: (packages, { asc }) => [asc(packages.speed)],
    }),
  ]);

  if (!customer) notFound();

  const packageOptions = pkgs.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Pelanggan</h1>
        <p className="text-muted-foreground">
          Perbarui data {customer.name}
        </p>
      </div>
      <CustomerForm
        packages={packageOptions}
        customerId={customer.id}
        defaultValues={{
          name: customer.name,
          address: customer.address,
          phone: customer.phone,
          email: customer.email ?? "",
          nik: customer.nik ?? "",
          packageId: String(customer.packageId),
          pppoeUsername: customer.pppoeUsername ?? "",
          onuSn: customer.onuSn ?? "",
          notes: customer.notes ?? "",
        }}
      />
    </div>
  );
}
