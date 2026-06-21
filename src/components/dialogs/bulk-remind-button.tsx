"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { readApiError } from "@/lib/http/read-api-error";

export function BulkRemindButton({ periodMonth }: { periodMonth?: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleBulkRemind() {
    const scope = periodMonth ? `periode ${periodMonth}` : "semua periode";
    if (
      !confirm(
        `Kirim pengingat WhatsApp ke semua tagihan belum bayar (${scope})?`
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/payments/bulk-remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(periodMonth ? { periodMonth } : {}),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, "Gagal mengirim pengingat"));
      }

      const json = await res.json();
      toast.success(json.message);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengirim pengingat"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleBulkRemind}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="mr-2 h-4 w-4" />
      )}
      Tagih Semua
    </Button>
  );
}
