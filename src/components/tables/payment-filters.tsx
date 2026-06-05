"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function PaymentFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/payments?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push("/payments");
  }, [router]);

  const hasFilters =
    searchParams.has("status") ||
    searchParams.has("paymentMethod") ||
    searchParams.has("periodMonth") ||
    searchParams.has("dateFrom") ||
    searchParams.has("dateTo");

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select
          value={searchParams.get("status") || ""}
          onValueChange={(val) => updateFilter("status", val || null)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Semua" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paid">Lunas</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="overdue">Tunggakan</SelectItem>
            <SelectItem value="cancelled">Dibatalkan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Metode</Label>
        <Select
          value={searchParams.get("paymentMethod") || ""}
          onValueChange={(val) => updateFilter("paymentMethod", val || null)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Semua" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Tunai</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="qris">QRIS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Periode</Label>
        <Input
          type="month"
          className="w-[160px]"
          value={searchParams.get("periodMonth") || ""}
          onChange={(e) => updateFilter("periodMonth", e.target.value || null)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Dari Tanggal</Label>
        <Input
          type="date"
          className="w-[150px]"
          value={searchParams.get("dateFrom") || ""}
          onChange={(e) => updateFilter("dateFrom", e.target.value || null)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Sampai Tanggal</Label>
        <Input
          type="date"
          className="w-[150px]"
          value={searchParams.get("dateTo") || ""}
          onChange={(e) => updateFilter("dateTo", e.target.value || null)}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-3 w-3" />
          Reset
        </Button>
      )}
    </div>
  );
}
