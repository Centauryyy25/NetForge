"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { SlaBadge } from "@/components/shared/sla-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDateShort } from "@/lib/utils";
import { toast } from "sonner";
import {
  REQUEST_TYPE_LABELS,
  type RequestType,
  type RequestStatus,
  type TicketPriority,
} from "@/lib/constants";

export interface ServiceRequestRow {
  id: number;
  ticketNumber: string;
  subject: string;
  type: RequestType;
  name: string;
  phone: string;
  status: RequestStatus;
  priority: TicketPriority;
  slaDeadline: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

function DeleteAction({ ticketId, ticketNumber }: { ticketId: number; ticketNumber: string }) {
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
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
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

function getColumns(userRole: string): ColumnDef<ServiceRequestRow>[] {
  const cols: ColumnDef<ServiceRequestRow>[] = [
    {
      accessorKey: "subject",
      header: "Tiket",
      cell: ({ row }) => (
        <div className="min-w-[200px]">
          <Link
            href={`/ticket/${row.original.id}`}
            className="font-medium hover:underline line-clamp-1"
          >
            {row.original.subject}
          </Link>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{row.original.ticketNumber}</span>
            <span>&middot;</span>
            <span>{REQUEST_TYPE_LABELS[row.original.type]}</span>
            <span>&middot;</span>
            <span>{row.original.name}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "priority",
      header: "Prioritas",
      cell: ({ row }) => (
        <StatusBadge status={row.getValue("priority")} type="priority" />
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.getValue("status")} type="request" />
      ),
    },
    {
      id: "sla",
      header: "SLA",
      cell: ({ row }) => (
        <SlaBadge
          slaDeadline={row.original.slaDeadline}
          resolvedAt={row.original.resolvedAt}
          priority={row.original.priority}
          paused={row.original.status === "pending"}
        />
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Dibuat",
      cell: ({ row }) => formatDateShort(row.getValue("createdAt")),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" render={<Link href={`/ticket/${row.original.id}`} />}>
            <Eye className="h-4 w-4" />
          </Button>
          {userRole === "admin" && (
            <DeleteAction ticketId={row.original.id} ticketNumber={row.original.ticketNumber} />
          )}
        </div>
      ),
    },
  ];

  return cols;
}

interface ServiceRequestTableProps {
  data: ServiceRequestRow[];
  userRole?: string;
}

export function ServiceRequestTable({ data, userRole = "technician" }: ServiceRequestTableProps) {
  const columns = getColumns(userRole);

  return (
    <DataTable
      columns={columns}
      data={data}
    />
  );
}
