"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";

interface TicketDeleteButtonProps {
  ticketId: number;
  ticketNumber: string;
}

export function TicketDeleteButton({ ticketId, ticketNumber }: TicketDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    try {
      const res = await fetch(`/api/ticket/${ticketId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Tiket ${ticketNumber} berhasil dihapus`);
      router.push("/ticket");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus tiket");
    } finally {
      setOpen(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="destructive" className="w-full">
          <Trash2 className="mr-2 h-4 w-4" />
          Hapus Tiket
        </Button>
      }
      title="Hapus Tiket"
      description={`Apakah Anda yakin ingin menghapus tiket ${ticketNumber}? Tindakan ini tidak dapat dibatalkan.`}
      confirmText="Hapus"
      variant="destructive"
      onConfirm={handleDelete}
    />
  );
}
