"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarPlus, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function GenerateInvoicePage() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [periodMonth, setPeriodMonth] = useState(defaultMonth);
  const [sendReminders, setSendReminders] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    total: number;
  } | null>(null);

  async function handleGenerate() {
    if (!periodMonth) {
      toast.error("Pilih periode bulan terlebih dahulu");
      return;
    }

    if (!confirm(`Generate tagihan untuk semua pelanggan aktif periode ${periodMonth}?`)) {
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/payments/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodMonth, sendReminders }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal generate tagihan");
      }

      const json = await res.json();
      setResult(json.data);
      toast.success(`${json.data.created} tagihan berhasil dibuat`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal generate tagihan"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" render={<Link href="/payments" />}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Generate Tagihan Bulanan</h1>
        <p className="text-muted-foreground">
          Buat tagihan untuk semua pelanggan aktif sekaligus
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Periode Tagihan
          </CardTitle>
          <CardDescription>
            Pilih bulan tagihan. Pelanggan yang sudah punya tagihan untuk bulan ini akan di-skip.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="period">Periode Bulan *</Label>
            <Input
              id="period"
              type="month"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={sendReminders}
              onCheckedChange={(checked) => setSendReminders(checked === true)}
            />
            <span className="flex items-center gap-1 text-sm">
              <MessageSquare className="h-3.5 w-3.5" />
              Kirim pengingat WhatsApp setelah generate
            </span>
          </label>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !periodMonth}
            className="w-full"
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="mr-2 h-4 w-4" />
            )}
            Generate Tagihan
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
              <div className="space-y-1">
                <p className="font-medium">Generate selesai</p>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  <li>Tagihan dibuat: <span className="font-medium text-foreground">{result.created}</span></li>
                  <li>Di-skip (sudah ada): <span className="font-medium text-foreground">{result.skipped}</span></li>
                  <li>Total pelanggan aktif: <span className="font-medium text-foreground">{result.total}</span></li>
                </ul>
                <div className="pt-2">
                  <Button variant="outline" size="sm" render={<Link href="/payments" />}>
                    Lihat Daftar Pembayaran
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
