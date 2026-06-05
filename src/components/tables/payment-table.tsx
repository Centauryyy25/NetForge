"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatRupiah, formatDateShort } from "@/lib/utils";
import type { PaymentStatus, PaymentMethod } from "@/lib/constants";

export interface PaymentRow {
  id: number;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  periodMonth: string;
  status: PaymentStatus;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
};

const columns: ColumnDef<PaymentRow>[] = [
  {
    accessorKey: "invoiceNumber",
    header: "No. Invoice",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.getValue("invoiceNumber")}</span>
    ),
  },
  {
    accessorKey: "customerName",
    header: "Pelanggan",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("customerName")}</span>
    ),
  },
  {
    accessorKey: "periodMonth",
    header: "Periode",
  },
  {
    accessorKey: "amount",
    header: "Jumlah",
    cell: ({ row }) => formatRupiah(row.getValue("amount")),
  },
  {
    accessorKey: "paymentMethod",
    header: "Metode",
    cell: ({ row }) =>
      METHOD_LABELS[row.getValue("paymentMethod") as PaymentMethod],
  },
  {
    accessorKey: "paymentDate",
    header: "Tanggal",
    cell: ({ row }) => {
      const date = row.getValue("paymentDate") as string;
      return date ? formatDateShort(date) : "-";
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.getValue("status")} type="payment" />
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" render={<Link href={`/payments/${row.original.id}`} />}>
        <Eye className="h-4 w-4" />
      </Button>
    ),
  },
];

interface PaymentTableProps {
  data: PaymentRow[];
}

export function PaymentTable({ data }: PaymentTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="customerName"
      searchPlaceholder="Cari pembayaran..."
    />
  );
}
