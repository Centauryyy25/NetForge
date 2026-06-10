import type { Metadata } from "next";
import { UserForm } from "@/components/forms/user-form";
import { requireRole } from "@/lib/auth-guard";

export const metadata: Metadata = {
  title: "Tambah User",
};

export default async function NewUserPage() {
  await requireRole(["admin"]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tambah User</h1>
        <p className="text-muted-foreground">
          Daftarkan user baru (admin, operator, atau teknisi)
        </p>
      </div>
      <UserForm />
    </div>
  );
}
