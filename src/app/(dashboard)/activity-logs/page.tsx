import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Log Aktivitas",
};

// TODO: Fetch from database / MikroTik API
const logs = [
  {
    id: 1,
    customerName: "Ahmad Fauzi",
    pppoeUsername: "yby-ahmad01",
    action: "login",
    duration: null,
    bytesIn: "1234567890",
    bytesOut: "234567890",
    timestamp: new Date("2026-04-06T08:30:00"),
  },
  {
    id: 2,
    customerName: "Budi Santoso",
    pppoeUsername: "yby-budi02",
    action: "logout",
    duration: 86400,
    bytesIn: "5678901234",
    bytesOut: "678901234",
    timestamp: new Date("2026-04-06T07:15:00"),
  },
  {
    id: 3,
    customerName: "Citra Dewi",
    pppoeUsername: "yby-citra03",
    action: "login",
    duration: null,
    bytesIn: "345678901",
    bytesOut: "45678901",
    timestamp: new Date("2026-04-05T22:45:00"),
  },
];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}j ${m}m`;
}

export default function ActivityLogsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Log Aktivitas</h1>
          <p className="text-muted-foreground">
            Riwayat login/logout dan penggunaan bandwidth pelanggan
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground">Waktu</th>
                  <th className="pb-3 font-medium text-muted-foreground">Pelanggan</th>
                  <th className="pb-3 font-medium text-muted-foreground">Username</th>
                  <th className="pb-3 font-medium text-muted-foreground">Aksi</th>
                  <th className="pb-3 font-medium text-muted-foreground">Durasi</th>
                  <th className="pb-3 font-medium text-muted-foreground">Download</th>
                  <th className="pb-3 font-medium text-muted-foreground">Upload</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-3 text-xs">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="py-3 font-medium">{log.customerName}</td>
                    <td className="py-3 font-mono text-xs">
                      {log.pppoeUsername}
                    </td>
                    <td className="py-3">
                      <Badge
                        variant={log.action === "login" ? "default" : "secondary"}
                      >
                        {log.action === "login" ? "Login" : "Logout"}
                      </Badge>
                    </td>
                    <td className="py-3">
                      {log.duration ? formatDuration(log.duration) : "-"}
                    </td>
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
        </CardContent>
      </Card>
    </div>
  );
}
