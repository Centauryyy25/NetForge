import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { CustomerActions } from "@/components/customers/customer-actions";
import { RetryProvisioningAlert } from "@/components/customers/retry-provisioning-alert";
import { formatRupiah, formatDate, formatSpeed, formatBytes } from "@/lib/utils";
import { CUSTOMER_STATUS_LABELS } from "@/lib/constants";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Detail Pelanggan",
};

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customerId = parseInt(id);
  if (isNaN(customerId)) notFound();

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
    with: {
      package: true,
      payments: { orderBy: (p, { desc }) => [desc(p.paymentDate)], limit: 20 },
      activityLogs: { orderBy: (l, { desc }) => [desc(l.timestamp)], limit: 50 },
    },
  });

  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {customer.name}
            </h1>
            <StatusBadge status={customer.status} type="customer" />
          </div>
          <p className="text-muted-foreground">{customer.customerId}</p>
        </div>
        <CustomerActions
          customerId={customer.id}
          customerName={customer.name}
          currentStatus={customer.status}
          pppoeUsername={customer.pppoeUsername}
        />
      </div>

      {customer.status === "provisioning_failed" && (
        <RetryProvisioningAlert customerId={customer.id} />
      )}

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informasi</TabsTrigger>
          <TabsTrigger value="payments">
            Pembayaran ({customer.payments?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="logs">
            Log Aktivitas ({customer.activityLogs?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Pribadi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Nama" value={customer.name} />
                <InfoRow label="Alamat" value={customer.address} />
                <InfoRow label="Telepon" value={customer.phone} />
                <InfoRow label="Email" value={customer.email ?? "-"} />
                <InfoRow label="NIK" value={customer.nik ?? "-"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Layanan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Paket" value={customer.package?.name ?? "-"} />
                <InfoRow
                  label="Kecepatan"
                  value={customer.package ? formatSpeed(customer.package.speed) : "-"}
                />
                <InfoRow
                  label="Harga"
                  value={customer.package ? formatRupiah(Number(customer.package.price)) : "-"}
                />
                <InfoRow
                  label="Terdaftar"
                  value={formatDate(customer.registrationDate)}
                />
                <InfoRow
                  label="Aktif Sampai"
                  value={formatDate(customer.activeUntil)}
                />
                <InfoRow
                  label="Status"
                  value={CUSTOMER_STATUS_LABELS[customer.status]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Teknis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow
                  label="PPPoE Username"
                  value={customer.pppoeUsername ?? "-"}
                />
                <InfoRow label="ONU S/N" value={customer.onuSn ?? "-"} />
                <InfoRow label="Catatan" value={customer.notes ?? "-"} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Pembayaran</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.payments && customer.payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium text-muted-foreground">Invoice</th>
                        <th className="pb-3 font-medium text-muted-foreground">Periode</th>
                        <th className="pb-3 font-medium text-muted-foreground">Jumlah</th>
                        <th className="pb-3 font-medium text-muted-foreground">Metode</th>
                        <th className="pb-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.payments.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-3 font-mono text-xs">{p.invoiceNumber}</td>
                          <td className="py-3">{p.periodMonth}</td>
                          <td className="py-3">{formatRupiah(Number(p.amount))}</td>
                          <td className="py-3 capitalize">{p.paymentMethod}</td>
                          <td className="py-3">
                            <StatusBadge status={p.status} type="payment" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Belum ada data pembayaran.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Log Aktivitas PPPoE</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.activityLogs && customer.activityLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium text-muted-foreground">Waktu</th>
                        <th className="pb-3 font-medium text-muted-foreground">Aksi</th>
                        <th className="pb-3 font-medium text-muted-foreground">Download</th>
                        <th className="pb-3 font-medium text-muted-foreground">Upload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.activityLogs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0">
                          <td className="py-3 text-xs">{formatDate(log.timestamp)}</td>
                          <td className="py-3 capitalize">{log.action}</td>
                          <td className="py-3 font-mono text-xs">
                            {log.bytesIn ? formatBytes(Number(log.bytesIn)) : "-"}
                          </td>
                          <td className="py-3 font-mono text-xs">
                            {log.bytesOut ? formatBytes(Number(log.bytesOut)) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Belum ada log aktivitas.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
