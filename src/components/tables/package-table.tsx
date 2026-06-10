"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/shared/data-table";
import { formatRupiah, formatSpeed } from "@/lib/utils";
import { toast } from "sonner";

export interface PackageRow {
  id: number;
  name: string;
  speed: number;
  price: number;
  queueTarget: string | null;
  isActive: boolean;
  customerCount: number;
}

function ActionsCell({ row }: { row: PackageRow }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Hapus paket "${row.name}"?`)) return;
    try {
      const res = await fetch(`/api/packages/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Paket dihapus");
      router.refresh();
    } catch {
      toast.error("Gagal menghapus paket");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columns: ColumnDef<PackageRow>[] = [
  {
    accessorKey: "name",
    header: "Nama Paket",
    cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
  },
  {
    accessorKey: "speed",
    header: "Kecepatan",
    cell: ({ row }) => formatSpeed(row.getValue("speed")),
  },
  {
    accessorKey: "price",
    header: "Harga / Bulan",
    cell: ({ row }) => formatRupiah(row.getValue("price")),
  },
  {
    accessorKey: "queueTarget",
    header: "Queue Target",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.getValue("queueTarget") ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "customerCount",
    header: "Pelanggan",
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.getValue("isActive") ? "default" : "secondary"}>
        {row.getValue("isActive") ? "Aktif" : "Nonaktif"}
      </Badge>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell row={row.original} />,
  },
];

interface PackageTableProps {
  data: PackageRow[];
}

export function PackageTable({ data }: PackageTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Cari paket..."
    />
  );
}
