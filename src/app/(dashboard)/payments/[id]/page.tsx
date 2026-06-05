import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatRupiah, formatDateShort } from "@/lib/utils";
import { RecordPaymentDialog } from "@/components/dialogs/record-payment-dialog";
import { CancelPaymentButton } from "@/components/dialogs/cancel-payment-button";

export const metadata: Metadata = {
  title: "Detail Pembayaran",
};

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  cash: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaymentDetailPage({ params }: Props) {
  const { id } = await params;
  const paymentId = parseInt(id);
  if (isNaN(paymentId)) notFound();

  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: {
      customer: {
        with: { package: true },
      },
      receiver: { columns: { id: true, name: true } },
    },
  });

  if (!payment) notFound();

  const isPending = payment.status === "pending" || payment.status === "overdue";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" render={<Link href="/payments" />}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {payment.invoiceNumber}
          </h1>
          <p className="text-muted-foreground">Detail pembayaran</p>
        </div>
        <StatusBadge status={payment.status} type="payment" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Invoice Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Tagihan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="No. Invoice" value={payment.invoiceNumber} mono />
            <InfoRow label="Periode" value={payment.periodMonth} />
            <InfoRow label="Jumlah" value={formatRupiah(Number(payment.amount))} />
            <InfoRow
              label="Metode Bayar"
              value={METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod || "-"}
            />
            <InfoRow
              label="Tanggal Bayar"
              value={payment.paymentDate ? formatDateShort(payment.paymentDate) : "-"}
            />
            <InfoRow
              label="Dibuat"
              value={formatDateShort(payment.createdAt)}
            />
            {payment.paidAt && (
              <InfoRow
                label="Dilunasi"
                value={formatDateShort(payment.paidAt)}
              />
            )}
            <InfoRow
              label="Sumber"
              value={payment.generatedBy === "bulk" ? "Generate Bulanan" : "Manual"}
            />
            {payment.notes && (
              <InfoRow label="Catatan" value={payment.notes} />
            )}
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Pelanggan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="Nama" value={payment.customer.name} />
            <InfoRow label="ID Pelanggan" value={payment.customer.customerId} mono />
            <InfoRow label="Alamat" value={payment.customer.address || "-"} />
            <InfoRow label="Telepon" value={payment.customer.phone || "-"} />
            {payment.customer.package && (
              <>
                <InfoRow label="Paket" value={payment.customer.package.name} />
                <InfoRow
                  label="Harga Paket"
                  value={formatRupiah(Number(payment.customer.package.price))}
                />
              </>
            )}
            <InfoRow
              label="Dicatat Oleh"
              value={payment.receiver?.name || "-"}
            />
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {payment.status === "paid" && (
          <Button
            variant="outline"
            render={
              <a href={`/api/payments/${payment.id}/receipt`} download>
                <Download className="mr-2 h-4 w-4" />
                Cetak Kwitansi
              </a>
            }
          />
        )}
        {isPending && (
          <RecordPaymentDialog paymentId={payment.id} currentStatus={payment.status} />
        )}
        {isPending && (
          <CancelPaymentButton paymentId={payment.id} />
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-medium ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
