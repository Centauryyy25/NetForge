"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, UserX, UserCheck, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useJobStatus } from "@/hooks/use-job-status";
import { toast } from "sonner";
import type { CustomerStatus } from "@/lib/constants";

interface CustomerActionsProps {
  customerId: number;
  customerName: string;
  currentStatus: CustomerStatus;
  pppoeUsername: string | null;
}

export function CustomerActions({
  customerId,
  customerName,
  currentStatus,
  pppoeUsername,
}: CustomerActionsProps) {
  const router = useRouter();
  const [confirmAction, setConfirmAction] = useState<"suspend" | "activate" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const { isCompleted, isFailed, status: jobStatus } = useJobStatus(jobId);

  // Show toast when job completes
  useEffect(() => {
    if (isCompleted) {
      toast.success("Sinkronisasi MikroTik berhasil");
      setJobId(null);
    }
    if (isFailed) {
      toast.error(`Sinkronisasi MikroTik gagal: ${jobStatus?.error ?? "Unknown"}`);
      setJobId(null);
    }
  }, [isCompleted, isFailed, jobStatus?.error]);

  async function handleStatusChange(newStatus: "suspended" | "active") {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error();

      const json = await res.json();

      toast.success(
        newStatus === "suspended"
          ? `${customerName} ditangguhkan`
          : `${customerName} diaktifkan kembali`
      );

      // Track MikroTik job if dispatched
      if (json.jobId && pppoeUsername) {
        setJobId(json.jobId);
        toast.info("Memproses sinkronisasi MikroTik...");
      }

      router.refresh();
    } catch {
      toast.error("Gagal mengubah status pelanggan");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" render={<Link href={`/customers/${customerId}/edit`} />}>
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </Button>

      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href={`/payments/new?customerId=${customerId}`} />}
      >
        <CreditCard className="mr-2 h-4 w-4" />
        Buat Pembayaran
      </Button>

      {currentStatus === "active" && (
        <Button
          variant="destructive"
          disabled={isLoading}
          onClick={() => setConfirmAction("suspend")}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserX className="mr-2 h-4 w-4" />
          )}
          Tangguhkan
        </Button>
      )}

      {currentStatus === "suspended" && (
        <Button
          disabled={isLoading}
          onClick={() => setConfirmAction("activate")}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="mr-2 h-4 w-4" />
          )}
          Aktifkan Kembali
        </Button>
      )}

      <ConfirmDialog
        open={confirmAction === "suspend"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Tangguhkan Pelanggan?"
        description={`Layanan internet ${customerName} akan diputus. Lanjutkan?`}
        confirmText="Ya, Tangguhkan"
        variant="destructive"
        onConfirm={() => handleStatusChange("suspended")}
      />
      <ConfirmDialog
        open={confirmAction === "activate"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Aktifkan Pelanggan?"
        description={`Layanan internet ${customerName} akan diaktifkan kembali. Lanjutkan?`}
        confirmText="Ya, Aktifkan"
        onConfirm={() => handleStatusChange("active")}
      />
    </div>
  );
}
