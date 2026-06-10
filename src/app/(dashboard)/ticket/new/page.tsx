import type { Metadata } from "next";
import { ServiceRequestForm } from "@/components/forms/service-request-form";

export const metadata: Metadata = {
  title: "Buat Tiket Baru",
};

export default function NewTicketPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Buat Tiket Baru</h1>
        <p className="text-muted-foreground">
          Buat tiket ajuan atau laporan gangguan baru
        </p>
      </div>
      <ServiceRequestForm />
    </div>
  );
}
