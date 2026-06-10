"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { toast } from "sonner";

export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

interface UserTableProps {
  data: UserRow[];
  currentUserId: number;
}

const roleFilterOptions = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({
  value: r,
  label: ROLE_LABELS[r],
}));

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function ActionsCell({
  row,
  currentUserId,
}: {
  row: UserRow;
  currentUserId: number;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isSelf = row.id === currentUserId;

  async function handleDelete() {
    try {
      const res = await fetch(`/api/users/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Gagal menghapus user");
      }
      toast.success(`User ${row.name} dihapus`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus user");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={<Link href={`/settings/users/${row.id}/edit`} />}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
        title="Hapus User?"
        description={`User ${row.name} akan dihapus permanen. Lanjutkan?`}
        confirmText="Ya, Hapus"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

export function UserTable({ data, currentUserId }: UserTableProps) {
  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "name",
      header: "Nama",
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.name}
          {row.original.id === currentUserId && (
            <span className="ml-2 text-xs text-muted-foreground">(Anda)</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="secondary">{ROLE_LABELS[row.original.role]}</Badge>
      ),
      filterFn: "equals",
    },
    {
      accessorKey: "createdAt",
      header: "Dibuat",
      cell: ({ row }) => dateFormatter.format(row.original.createdAt),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <ActionsCell row={row.original} currentUserId={currentUserId} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      globalSearch
      searchPlaceholder="Cari nama atau email..."
      filterColumns={[
        { columnKey: "role", label: "Role", options: roleFilterOptions },
      ]}
    />
  );
}
