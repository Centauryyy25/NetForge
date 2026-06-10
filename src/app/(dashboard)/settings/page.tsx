import type { Metadata } from "next";
import { SettingsForm } from "@/components/forms/settings-form";

export const metadata: Metadata = {
  title: "Pengaturan",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-muted-foreground">
          Konfigurasi sistem dan integrasi
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
