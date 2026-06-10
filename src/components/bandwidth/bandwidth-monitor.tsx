"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
  ArrowDown,
  ArrowUp,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BandwidthChart } from "@/components/charts/bandwidth-chart";
import { formatBytes } from "@/lib/utils";

const POLL_INTERVAL_MS = 30_000; // 30 seconds — safe for production

interface Connection {
  name: string;
  address: string;
  callerId: string;
  uptime: string;
  service: string;
  maxLimit: string;
  txRate: number;
  rxRate: number;
}

interface Summary {
  online: number;
  offline: number;
  totalCustomers: number;
  totalTx: number;
  totalRx: number;
  totalThroughput: number;
}

interface TrafficPoint {
  time: string;
  download: number;
  upload: number;
}

export function BandwidthMonitor() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trafficHistory, setTrafficHistory] = useState<TrafficPoint[]>([]);
  const [currentTraffic, setCurrentTraffic] = useState({ txRate: 0, rxRate: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    setError("");

    try {
      // Fetch bandwidth + traffic in parallel
      const [bwRes, trafficRes] = await Promise.all([
        fetch("/api/bandwidth"),
        fetch("/api/bandwidth/traffic"),
      ]);

      if (!bwRes.ok) {
        const err = await bwRes.json();
        throw new Error(err.error ?? "Gagal mengambil data bandwidth");
      }

      const bwJson = await bwRes.json();
      setConnections(bwJson.data.connections);
      setSummary(bwJson.data.summary);

      if (trafficRes.ok) {
        const trafficJson = await trafficRes.json();
        setCurrentTraffic(trafficJson.data.current);
        setTrafficHistory(trafficJson.data.history);
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal terhubung");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(() => fetchData(), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  function handleManualRefresh() {
    // Reset polling timer on manual refresh
    if (intervalRef.current) clearInterval(intervalRef.current);
    fetchData(true);
    intervalRef.current = setInterval(() => fetchData(), POLL_INTERVAL_MS);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Menghubungkan ke MikroTik...</span>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-10">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground">
              Pastikan konfigurasi MikroTik sudah benar di menu Pengaturan.
            </p>
          </div>
          <Button variant="outline" className="ml-auto" onClick={handleManualRefresh}>
            Coba Lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bandwidth</h1>
          <p className="text-muted-foreground">
            Monitor koneksi aktif dan kontrol bandwidth
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Update: {lastUpdated.toLocaleTimeString("id-ID")}
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error banner (non-blocking) */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Koneksi Aktif
            </CardTitle>
            <Wifi className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.online ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              dari {summary?.totalCustomers ?? 0} pelanggan PPPoE
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Koneksi Offline
            </CardTitle>
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.offline ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Download
            </CardTitle>
            <ArrowDown className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(currentTraffic.rxRate)}/s
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upload
            </CardTitle>
            <ArrowUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(currentTraffic.txRate)}/s
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Traffic Real-time
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Polling tiap 30 detik
          </span>
        </CardHeader>
        <CardContent>
          <BandwidthChart data={trafficHistory} />
        </CardContent>
      </Card>

      {/* Active Connections Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Koneksi PPPoE Aktif ({connections.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tidak ada koneksi aktif saat ini
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Username</th>
                    <th className="pb-3 font-medium text-muted-foreground">IP Address</th>
                    <th className="pb-3 font-medium text-muted-foreground">Uptime</th>
                    <th className="pb-3 font-medium text-muted-foreground">MAC Address</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Download</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Upload</th>
                    <th className="pb-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((conn) => (
                    <tr key={conn.name} className="border-b last:border-0">
                      <td className="py-3 font-medium">{conn.name}</td>
                      <td className="py-3 font-mono text-xs">{conn.address}</td>
                      <td className="py-3">{conn.uptime}</td>
                      <td className="py-3 font-mono text-xs">{conn.callerId}</td>
                      <td className="py-3 text-right font-mono text-xs">
                        {formatBytes(conn.rxRate)}/s
                      </td>
                      <td className="py-3 text-right font-mono text-xs">
                        {formatBytes(conn.txRate)}/s
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">
                          Online
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
