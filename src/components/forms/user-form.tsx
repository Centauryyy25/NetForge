"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ROLE_LABELS, type Role } from "@/lib/constants";

interface UserFormProps {
  userId?: number;
  defaultValues?: {
    name: string;
    email: string;
    role: Role;
  };
  /** When true, role select is disabled (editing own account). */
  lockRole?: boolean;
}

export function UserForm({ userId, defaultValues, lockRole }: UserFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<Role>(defaultValues?.role ?? "operator");
  const isEdit = !!defaultValues;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = (formData.get("password") as string) ?? "";

    const body: Record<string, unknown> = {
      name: formData.get("name"),
      email: formData.get("email"),
      role,
    };
    if (!isEdit || password.trim() !== "") {
      body.password = password;
    }

    try {
      const url = isEdit ? `/api/users/${userId}` : "/api/users";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Gagal menyimpan");
      }

      toast.success(
        isEdit ? "Data user diperbarui" : "User berhasil ditambahkan"
      );
      router.push("/settings/users");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan user");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nama Lengkap *</Label>
              <Input
                id="name"
                name="name"
                required
                minLength={2}
                defaultValue={defaultValues?.name}
                placeholder="Nama user"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={defaultValues?.email}
                placeholder="user@ybynet.id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as Role)}
                disabled={lockRole}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lockRole && (
                <p className="text-xs text-muted-foreground">
                  Tidak dapat mengubah role akun sendiri.
                </p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="password">
                {isEdit
                  ? "Password Baru (kosongkan jika tidak diubah)"
                  : "Password *"}
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required={!isEdit}
                minLength={isEdit ? undefined : 8}
                placeholder={isEdit ? "••••••••" : "Minimal 8 karakter"}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan Perubahan" : "Tambah User"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
