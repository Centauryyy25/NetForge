"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupiah } from "@/lib/utils";

interface CustomerReceivable {
  customerId: number;
  customerCode: string;
  customerName: string;
  customerPhone: string;
  periods: { month: string; amount: number; status: string }[];
  totalOutstanding: number;
  agingMonths: number;
}

interface ReceivablesTableProps {
  customers: CustomerReceivable[];
}

function agingVariant(months: number): "default" | "secondary" | "destructive" {
  if (months <= 1) return "secondary";
  if (months === 2) return "default";
  return "destructive";
}

function agingLabel(months: number): string {
  if (months <= 1) return "1 bulan";
  return `${months} bulan`;
}

export function ReceivablesTable({ customers }: ReceivablesTableProps) {
  if (customers.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Tidak ada piutang. Semua tagihan sudah lunas.
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pelanggan</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Aging</TableHead>
            <TableHead>Periode Tertunggak</TableHead>
            <TableHead className="text-right">Total Piutang</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow key={c.customerId}>
              <TableCell className="font-medium">{c.customerName}</TableCell>
              <TableCell className="font-mono text-xs">{c.customerCode}</TableCell>
              <TableCell>
                <Badge variant={agingVariant(c.agingMonths)}>
                  {agingLabel(c.agingMonths)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {c.periods.map((p) => (
                    <Badge key={p.month} variant="outline" className="text-xs">
                      {p.month}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatRupiah(c.totalOutstanding)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
