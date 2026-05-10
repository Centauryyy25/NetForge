"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Props {
  customerId: number;
}

export function RetryProvisioningAlert({ customerId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  const handleRetry = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/customers/${customerId}/retry-provisioning`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Gagal");
      toast.success("Provisioning di-antrekan ulang");
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>Provisioning MikroTik Gagal</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3">
        <span>
          PPPoE belum terdaftar di RouterOS. Klik tombol untuk mencoba ulang
          (password baru akan dihasilkan).
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={submitting || isPending}
          onClick={handleRetry}
        >
          <RotateCw className={submitting ? "animate-spin" : ""} />
          {submitting ? "Memproses..." : "Retry Provisioning"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
