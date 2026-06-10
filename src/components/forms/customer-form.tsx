"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface PackageOption {
  id: number;
  name: string;
  price: number;
}

interface CustomerFormProps {
  packages: PackageOption[];
  customerId?: number;
  defaultValues?: {
    name: string;
    address: string;
    phone: string;
    email: string;
    nik: string;
    packageId: string;
    pppoeUsername: string;
    onuSn: string;
    notes: string;
  };
}

export function CustomerForm({ packages, customerId, defaultValues }: CustomerFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isEdit = !!defaultValues;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      nik: formData.get("nik") as string,
      packageId: Number(formData.get("packageId")),
      pppoeUsername: formData.get("pppoeUsername") as string,
      onuSn: formData.get("onuSn") as string,
      notes: formData.get("notes") as string,
    };

    try {
      const url = isEdit ? `/api/customers/${customerId}` : "/api/customers";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal menyimpan");
      }

      toast.success(
        isEdit ? "Data pelanggan diperbarui" : "Pelanggan berhasil ditambahkan",
      );
      router.push("/customers");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan data pelanggan");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Data Pribadi</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nama Lengkap *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={defaultValues?.name}
                  placeholder="Nama pelanggan"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Alamat *</Label>
                <Textarea
                  id="address"
                  name="address"
                  required
                  defaultValue={defaultValues?.address}
                  placeholder="Alamat lengkap"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">No. Telepon *</Label>
                <Input
                  id="phone"
                  name="phone"
                  required
                  defaultValue={defaultValues?.phone}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={defaultValues?.email}
                  placeholder="email@contoh.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nik">NIK</Label>
                <Input
                  id="nik"
                  name="nik"
                  maxLength={16}
                  defaultValue={defaultValues?.nik}
                  placeholder="16 digit NIK"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Data Layanan</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="packageId">Paket Layanan *</Label>
                <Select
                  name="packageId"
                  defaultValue={defaultValues?.packageId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih paket" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={String(pkg.id)}>
                        {pkg.name} — Rp{" "}
                        {pkg.price.toLocaleString("id-ID")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pppoeUsername">PPPoE Username</Label>
                <Input
                  id="pppoeUsername"
                  name="pppoeUsername"
                  defaultValue={defaultValues?.pppoeUsername}
                  placeholder="yby-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onuSn">ONU Serial Number</Label>
                <Input
                  id="onuSn"
                  name="onuSn"
                  defaultValue={defaultValues?.onuSn}
                  placeholder="ZTEG12345678"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={defaultValues?.notes}
              placeholder="Catatan tambahan (opsional)"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan Perubahan" : "Tambah Pelanggan"}
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
