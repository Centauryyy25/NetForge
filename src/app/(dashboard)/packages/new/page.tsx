import type { Metadata } from "next";
import { PackageForm } from "@/components/forms/package-form";

export const metadata: Metadata = {
  title: "Tambah Paket",
};

export default function NewPackagePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tambah Paket</h1>
        <p className="text-muted-foreground">
          Buat paket layanan internet baru
        </p>
      </div>
      <PackageForm />
    </div>
  );
}
