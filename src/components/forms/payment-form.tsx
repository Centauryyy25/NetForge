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
import { formatRupiah } from "@/lib/utils";

interface CustomerOption {
  id: number;
  customerId: string;
  name: string;
  packagePrice: number;
}

interface PaymentFormProps {
  customers: CustomerOption[];
}

export function PaymentForm({ customers }: PaymentFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");

  const customer = customers.find((c) => String(c.id) === selectedCustomer);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      customerId: Number(formData.get("customerId")),
      amount: Number(formData.get("amount")),
      periodMonth: formData.get("periodMonth") as string,
      paymentMethod: formData.get("paymentMethod") as string,
      paymentDate: formData.get("paymentDate") as string,
      notes: (formData.get("notes") as string) || undefined,
    };

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal mencatat pembayaran");
      }

      toast.success("Pembayaran berhasil dicatat");
      router.push("/payments");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mencatat pembayaran");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customerId">Pelanggan *</Label>
            <Select
              name="customerId"
              required
              value={selectedCustomer}
              onValueChange={(val) => setSelectedCustomer(val ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih pelanggan" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} ({c.customerId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {customer && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                Tagihan paket:{" "}
                <span className="font-semibold text-foreground">
                  {formatRupiah(customer.packagePrice)}
                </span>
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Jumlah Bayar (Rp) *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                required
                min={0}
                defaultValue={customer?.packagePrice}
                placeholder="175000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodMonth">Periode Bulan *</Label>
              <Input
                id="periodMonth"
                name="periodMonth"
                type="month"
                required
                defaultValue={new Date().toISOString().slice(0, 7)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Metode Pembayaran *</Label>
              <Select name="paymentMethod" required defaultValue="cash">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tunai</SelectItem>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Tanggal Bayar *</Label>
              <Input
                id="paymentDate"
                name="paymentDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Catatan tambahan (opsional)"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Catat Pembayaran
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
