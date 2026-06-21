"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { readApiError } from "@/lib/http/read-api-error";

export function MarkOverdueButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleMarkOverdue() {
    if (!confirm("Cek dan tandai semua tagihan yang melewati jatuh tempo sebagai tunggakan?")) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/payments/mark-overdue", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, "Gagal menandai tunggakan"));
      }

      const json = await res.json();
      toast.success(json.message);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menandai tunggakan"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleMarkOverdue} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <AlertTriangle className="mr-2 h-4 w-4" />
      )}
      Cek Tunggakan
    </Button>
  );
}
