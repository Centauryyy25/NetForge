"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface PackageFormProps {
  packageId?: number;
  defaultValues?: {
    name: string;
    speed: number;
    price: number;
    queueTarget: string;
    isActive: boolean;
  };
}

export function PackageForm({ packageId, defaultValues }: PackageFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isEdit = !!defaultValues;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name") as string,
      speed: Number(formData.get("speed")),
      price: Number(formData.get("price")),
      queueTarget: formData.get("queueTarget") as string,
      isActive: formData.get("isActive") === "on",
    };

    try {
      const url = isEdit ? `/api/packages/${packageId}` : "/api/packages";
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

      toast.success(isEdit ? "Paket diperbarui" : "Paket berhasil ditambahkan");
      router.push("/packages");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan paket");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Paket *</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={defaultValues?.name}
              placeholder="Paket 20 Mbps"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="speed">Kecepatan (Mbps) *</Label>
              <Input
                id="speed"
                name="speed"
                type="number"
                required
                min={1}
                defaultValue={defaultValues?.speed}
                placeholder="20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Harga per Bulan (Rp) *</Label>
              <Input
                id="price"
                name="price"
                type="number"
                required
                min={0}
                defaultValue={defaultValues?.price}
                placeholder="175000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="queueTarget">Queue Target (MikroTik)</Label>
            <Input
              id="queueTarget"
              name="queueTarget"
              defaultValue={defaultValues?.queueTarget}
              placeholder="20M/20M"
            />
            <p className="text-xs text-muted-foreground">
              Format: upload/download (contoh: 20M/20M)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="isActive"
              name="isActive"
              defaultChecked={defaultValues?.isActive ?? true}
            />
            <Label htmlFor="isActive">Paket Aktif</Label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan Perubahan" : "Tambah Paket"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
