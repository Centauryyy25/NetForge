"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CancelPaymentButtonProps {
  paymentId: number;
}

export function CancelPaymentButton({ paymentId }: CancelPaymentButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCancel() {
    if (!confirm("Yakin ingin membatalkan tagihan ini?")) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Gagal membatalkan");
      }

      toast.success("Tagihan berhasil dibatalkan");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal membatalkan tagihan"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleCancel}
      disabled={isSubmitting}
    >
      {isSubmitting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <XCircle className="mr-2 h-4 w-4" />
      )}
      Batalkan
    </Button>
  );
}
