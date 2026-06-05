"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { ReceivablesTable } from "@/components/tables/receivables-table";
import { formatRupiah } from "@/lib/utils";

interface ReceivablesData {
  customers: any[];
  summary: {
    total1Month: number;
    total2Months: number;
    total3Plus: number;
    grandTotal: number;
    count1Month: number;
    count2Months: number;
    count3Plus: number;
  };
}

export default function ReportsPage() {
  const [data, setData] = useState<{ stats: any; revenueData: any[] } | null>(null);
  const [receivables, setReceivables] = useState<ReceivablesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/reports/receivables").then((r) => r.json()),
    ])
      .then(([dashJson, recJson]) => {
        setData(dashJson.data);
        setReceivables(recJson.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch report data:", err);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan</h1>
          <p className="text-muted-foreground">Memuat data laporan...</p>
        </div>
      </div>
    );
  }

  const { stats, revenueData } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporan</h1>
        <p className="text-muted-foreground">
          Laporan keuangan dan operasional YBY NET
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pemasukan Bulan Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatRupiah(stats?.monthlyRevenue || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pembayaran Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {stats?.pendingPayments || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pelanggan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalCustomers || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tunggakan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats?.overduePayments || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Pendapatan</TabsTrigger>
          <TabsTrigger value="receivables">Piutang</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Grafik Pendapatan Bulanan</CardTitle>
              <CardDescription>
                Tren pemasukan 12 bulan terakhir
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueChart data={revenueData || []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receivables" className="mt-4 space-y-4">
          {receivables && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tunggakan 1 Bulan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatRupiah(receivables.summary.total1Month)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {receivables.summary.count1Month} pelanggan
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tunggakan 2 Bulan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">
                    {formatRupiah(receivables.summary.total2Months)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {receivables.summary.count2Months} pelanggan
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tunggakan 3+ Bulan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {formatRupiah(receivables.summary.total3Plus)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {receivables.summary.count3Plus} pelanggan
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Piutang
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatRupiah(receivables.summary.grandTotal)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Daftar Piutang</CardTitle>
              <CardDescription>
                Pelanggan dengan tunggakan pembayaran
              </CardDescription>
            </CardHeader>
            <CardContent>
              {receivables ? (
                <ReceivablesTable customers={receivables.customers} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Memuat data piutang...
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
