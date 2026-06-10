import type { Metadata } from "next";
import { PaymentForm } from "@/components/forms/payment-form";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Catat Pembayaran",
};

export default async function NewPaymentPage() {
  const data = await db.query.customers.findMany({
    where: eq(customers.status, "active"),
    with: { package: { columns: { price: true } } },
    orderBy: (customers, { asc }) => [asc(customers.name)],
  });

  const customerOptions = data.map((c) => ({
    id: c.id,
    customerId: c.customerId,
    name: c.name,
    packagePrice: Number(c.package.price),
  }));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Catat Pembayaran
        </h1>
        <p className="text-muted-foreground">
          Rekam pembayaran dari pelanggan
        </p>
      </div>
      <PaymentForm customers={customerOptions} />
    </div>
  );
}
