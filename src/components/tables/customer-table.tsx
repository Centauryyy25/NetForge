"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Pencil, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatRupiah, formatSpeed } from "@/lib/utils";
import { CUSTOMER_STATUS_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import type { CustomerStatus } from "@/lib/constants";

export interface CustomerRow {
  id: number;
  customerId: string;
  name: string;
  phone: string;
  packageName: string;
  speed: number;
  price: number;
  status: CustomerStatus;
  pppoeUsername: string;
}

type ConfirmAction = "suspend" | "activate" | null;

function ActionsCell({ row }: { row: CustomerRow }) {
  const router = useRouter();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  async function handleStatusChange(newStatus: "suspended" | "active") {
    try {
      const res = await fetch(`/api/customers/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        newStatus === "suspended"
          ? `${row.name} ditangguhkan`
          : `${row.name} diaktifkan kembali`
      );
      router.refresh();
    } catch {
      toast.error(
        newStatus === "suspended"
          ? "Gagal menangguhkan pelanggan"
          : "Gagal mengaktifkan pelanggan"
      );
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/customers/${row.id}`} />}>
            <Eye className="mr-2 h-4 w-4" />
            Lihat Detail
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/customers/${row.id}/edit`} />}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          {row.status === "active" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmAction("suspend")}
              >
                <UserX className="mr-2 h-4 w-4" />
                Tangguhkan
              </DropdownMenuItem>
            </>
          )}
          {row.status === "suspended" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConfirmAction("activate")}>
                <UserCheck className="mr-2 h-4 w-4" />
                Aktifkan Kembali
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmAction === "suspend"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Tangguhkan Pelanggan?"
        description={`Layanan internet ${row.name} akan diputus. Lanjutkan?`}
        confirmText="Ya, Tangguhkan"
        variant="destructive"
        onConfirm={() => handleStatusChange("suspended")}
      />
      <ConfirmDialog
        open={confirmAction === "activate"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Aktifkan Pelanggan?"
        description={`Layanan internet ${row.name} akan diaktifkan kembali. Lanjutkan?`}
        confirmText="Ya, Aktifkan"
        onConfirm={() => handleStatusChange("active")}
      />
    </>
  );
}

const columns: ColumnDef<CustomerRow>[] = [
  {
    accessorKey: "customerId",
    header: "ID Pelanggan",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.getValue("customerId")}</span>
    ),
  },
  {
    accessorKey: "name",
    header: "Nama",
    cell: ({ row }) => (
      <Link
        href={`/customers/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.getValue("name")}
      </Link>
    ),
  },
  {
    accessorKey: "phone",
    header: "Telepon",
  },
  {
    accessorKey: "packageName",
    header: "Paket",
    cell: ({ row }) => (
      <div>
        <span>{row.original.packageName}</span>
        {row.original.speed > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">
            ({formatSpeed(row.original.speed)})
          </span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "price",
    header: "Harga",
    cell: ({ row }) => formatRupiah(row.getValue("price")),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.getValue("status")} type="customer" />
    ),
    filterFn: "equals",
  },
  {
    accessorKey: "pppoeUsername",
    header: () => null,
    cell: () => null,
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell row={row.original} />,
  },
];

const statusFilterOptions = Object.entries(CUSTOMER_STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
);

interface CustomerTableProps {
  data: CustomerRow[];
}

function BulkActions({
  selectedRows,
  onComplete,
}: {
  selectedRows: CustomerRow[];
  onComplete: () => void;
}) {
  const router = useRouter();
  const [confirmAction, setConfirmAction] = useState<"suspend" | "activate" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleBulk(action: "suspend" | "activate") {
    setIsLoading(true);
    try {
      const res = await fetch("/api/customers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          customerIds: selectedRows.map((r) => r.id),
        }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      toast.success(
        `${json.processed} pelanggan ${action === "suspend" ? "ditangguhkan" : "diaktifkan"}`
      );
      onComplete();
      router.refresh();
    } catch {
      toast.error("Gagal memproses bulk action");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        disabled={isLoading}
        onClick={() => setConfirmAction("suspend")}
      >
        <UserX className="mr-2 h-4 w-4" />
        Tangguhkan Semua
      </Button>
      <Button
        size="sm"
        disabled={isLoading}
        onClick={() => setConfirmAction("activate")}
      >
        <UserCheck className="mr-2 h-4 w-4" />
        Aktifkan Semua
      </Button>

      <ConfirmDialog
        open={confirmAction === "suspend"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Tangguhkan Pelanggan Terpilih?"
        description={`${selectedRows.length} pelanggan akan ditangguhkan. Layanan internet mereka akan diputus. Lanjutkan?`}
        confirmText="Ya, Tangguhkan Semua"
        variant="destructive"
        onConfirm={() => handleBulk("suspend")}
      />
      <ConfirmDialog
        open={confirmAction === "activate"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Aktifkan Pelanggan Terpilih?"
        description={`${selectedRows.length} pelanggan akan diaktifkan kembali. Lanjutkan?`}
        confirmText="Ya, Aktifkan Semua"
        onConfirm={() => handleBulk("activate")}
      />
    </>
  );
}

export function CustomerTable({ data }: CustomerTableProps) {
  const [selectedRows, setSelectedRows] = useState<CustomerRow[]>([]);

  return (
    <DataTable
      columns={columns}
      data={data}
      globalSearch
      searchPlaceholder="Cari nama, telepon, ID, PPPoE..."
      filterColumns={[
        {
          columnKey: "status",
          label: "Status",
          options: statusFilterOptions,
        },
      ]}
      enableRowSelection
      onSelectionChange={setSelectedRows}
      bulkActions={
        <BulkActions
          selectedRows={selectedRows}
          onComplete={() => setSelectedRows([])}
        />
      }
    />
  );
}
