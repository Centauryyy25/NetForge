"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  Router,
  Cpu,
  Clock,
  Server,
  MessageSquare,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface MikroTikStatus {
  identity: string;
  cpuLoad: string;
  uptime: string;
  version: string;
  boardName: string;
  totalMemory: string;
  freeMemory: string;
}

interface SettingsData {
  mikrotikHost: string;
  mikrotikPort: number;
  mikrotikUser: string;
  mikrotikPassword: string;
  fonnteToken: string;
  fonnteApiUrl: string;
  billingDueDay: number;
  billingCompanyName: string;
  billingCompanyAddress: string;
  billingCompanyPhone: string;
}

export function SettingsForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [routerInfo, setRouterInfo] = useState<MikroTikStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isTestingFonnte, setIsTestingFonnte] = useState(false);
  const [fonnteTestPhone, setFonnteTestPhone] = useState("");

  const [form, setForm] = useState<SettingsData>({
    mikrotikHost: "",
    mikrotikPort: 8728,
    mikrotikUser: "",
    mikrotikPassword: "",
    fonnteToken: "",
    fonnteApiUrl: "https://api.fonnte.com/send",
    billingDueDay: 20,
    billingCompanyName: "",
    billingCompanyAddress: "",
    billingCompanyPhone: "",
  });

  // Load saved settings and auto-test connection
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (cancelled) return;

        if (json.data) {
          setForm(json.data);

          // Auto-test if MikroTik config exists
          if (json.data.mikrotikHost) {
            const testRes = await fetch("/api/settings/test-mikrotik", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                host: json.data.mikrotikHost,
                port: json.data.mikrotikPort,
                user: json.data.mikrotikUser,
                password: json.data.mikrotikPassword,
              }),
            });
            if (cancelled) return;
            const testJson = await testRes.json();
            if (testJson.success) {
              setConnected(true);
              setRouterInfo(testJson.data);
            } else {
              setConnected(false);
              setErrorMessage(testJson.error || "Koneksi gagal");
            }
          }
        }
      } catch {
        if (!cancelled) toast.error("Gagal memuat pengaturan");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  function updateField(key: keyof SettingsData, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function testFonnteConnection() {
    if (!form.fonnteToken || !fonnteTestPhone) {
      toast.error("Token Fonnte dan Nomor WA tujuan wajib diisi");
      return;
    }

    setIsTestingFonnte(true);

    try {
      const res = await fetch("/api/settings/test-fonnte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: form.fonnteApiUrl,
          token: form.fonnteToken,
          phone: fonnteTestPhone,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success("Pesan percobaan berhasil terkirim!");
      } else {
        toast.error(json.error || "Gagal mengirim pesan percobaan");
      }
    } catch {
      toast.error("Terjadi kesalahan saat menguji Fonnte");
    } finally {
      setIsTestingFonnte(false);
    }
  }

  async function testConnection(overrideData?: SettingsData) {
    const data = overrideData ?? form;
    if (!data.mikrotikHost || !data.mikrotikUser || !data.mikrotikPassword) {
      toast.error("Lengkapi konfigurasi MikroTik terlebih dahulu");
      return;
    }

    setIsTesting(true);
    setConnected(null);
    setRouterInfo(null);
    setErrorMessage("");

    try {
      const res = await fetch("/api/settings/test-mikrotik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: data.mikrotikHost,
          port: data.mikrotikPort,
          user: data.mikrotikUser,
          password: data.mikrotikPassword,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setConnected(true);
        setRouterInfo(json.data);
      } else {
        setConnected(false);
        setErrorMessage(json.error || "Koneksi gagal");
      }
    } catch {
      setConnected(false);
      setErrorMessage("Tidak dapat terhubung ke server");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      const [resMain, resBilling] = await Promise.all([
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }),
        fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billingDueDay: form.billingDueDay,
            billingCompanyName: form.billingCompanyName,
            billingCompanyAddress: form.billingCompanyAddress,
            billingCompanyPhone: form.billingCompanyPhone,
          }),
        }),
      ]);

      if (!resMain.ok) {
        const err = await resMain.json();
        throw new Error(err.error ?? "Gagal menyimpan");
      }
      if (!resBilling.ok) {
        const err = await resBilling.json();
        throw new Error(err.error ?? "Gagal menyimpan pengaturan billing");
      }

      toast.success("Pengaturan berhasil disimpan");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan"
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* MikroTik Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Router className="h-5 w-5" />
                MikroTik Router
              </CardTitle>
              <CardDescription>
                Konfigurasi koneksi ke MikroTik RouterOS API
              </CardDescription>
            </div>
            {connected !== null && (
              <Badge variant={connected ? "default" : "destructive"}>
                {connected ? (
                  <>
                    <Wifi className="mr-1 h-3 w-3" />
                    Terhubung
                  </>
                ) : (
                  <>
                    <WifiOff className="mr-1 h-3 w-3" />
                    Terputus
                  </>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mikrotik-host">Host / IP *</Label>
              <Input
                id="mikrotik-host"
                placeholder="10.10.10.1"
                value={form.mikrotikHost}
                onChange={(e) => updateField("mikrotikHost", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mikrotik-port">Port *</Label>
              <Input
                id="mikrotik-port"
                type="number"
                placeholder="8728"
                value={form.mikrotikPort}
                onChange={(e) =>
                  updateField("mikrotikPort", Number(e.target.value))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mikrotik-user">Username *</Label>
              <Input
                id="mikrotik-user"
                placeholder="si-api"
                value={form.mikrotikUser}
                onChange={(e) => updateField("mikrotikUser", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mikrotik-pass">Password</Label>
              <Input
                id="mikrotik-pass"
                type="password"
                placeholder="Kosongkan jika tanpa password"
                value={form.mikrotikPassword}
                onChange={(e) =>
                  updateField("mikrotikPassword", e.target.value)
                }
              />
            </div>
          </div>

          {/* Router Info Panel */}
          {connected && routerInfo && (
            <>
              <Separator />
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="mb-3 text-sm font-medium text-muted-foreground">
                  Informasi Router
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoItem
                    icon={<Server className="h-4 w-4" />}
                    label="Identity"
                    value={routerInfo.identity}
                  />
                  <InfoItem
                    icon={<Router className="h-4 w-4" />}
                    label="Board"
                    value={`${routerInfo.boardName} (${routerInfo.version})`}
                  />
                  <InfoItem
                    icon={<Cpu className="h-4 w-4" />}
                    label="CPU Load"
                    value={`${routerInfo.cpuLoad}%`}
                  />
                  <InfoItem
                    icon={<Clock className="h-4 w-4" />}
                    label="Uptime"
                    value={routerInfo.uptime}
                  />
                </div>
              </div>
            </>
          )}

          {/* Error Message */}
          {connected === false && errorMessage && (
            <>
              <Separator />
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            disabled={isTesting}
            onClick={() => testConnection()}
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : connected ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
            ) : (
              <Wifi className="mr-2 h-4 w-4" />
            )}
            Test Koneksi
          </Button>
        </CardContent>
      </Card>

      {/* Fonnte Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Gateway (Fonnte)
          </CardTitle>
          <CardDescription>
            Konfigurasi pengiriman notifikasi tagihan via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fonnte-url">API URL</Label>
            <Input
              id="fonnte-url"
              placeholder="https://api.fonnte.com/send"
              value={form.fonnteApiUrl}
              onChange={(e) => updateField("fonnteApiUrl", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fonnte-token">API Token</Label>
            <Input
              id="fonnte-token"
              type="password"
              placeholder="••••••••"
              value={form.fonnteToken}
              onChange={(e) => updateField("fonnteToken", e.target.value)}
            />
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-2">
            <Label htmlFor="fonnte-test-phone">Test WhatsApp</Label>
            <div className="flex gap-2">
              <Input
                id="fonnte-test-phone"
                placeholder="081234567890"
                value={fonnteTestPhone}
                onChange={(e) => setFonnteTestPhone(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={testFonnteConnection}
                disabled={isTestingFonnte || !form.fonnteToken || !fonnteTestPhone}
              >
                {isTestingFonnte ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="mr-2 h-4 w-4" />
                )}
                Test Pesan
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Masukkan nomor WA untuk menguji pengiriman (contoh: 081234567890)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Billing Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Billing & Kwitansi
          </CardTitle>
          <CardDescription>
            Konfigurasi jatuh tempo tagihan dan informasi perusahaan untuk kwitansi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billing-due-day">Tanggal Jatuh Tempo *</Label>
              <Input
                id="billing-due-day"
                type="number"
                min={1}
                max={28}
                placeholder="20"
                value={form.billingDueDay}
                onChange={(e) =>
                  updateField("billingDueDay", Number(e.target.value))
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Tanggal jatuh tempo pembayaran setiap bulan (1-28)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-phone">No. Telepon Perusahaan</Label>
              <Input
                id="billing-phone"
                placeholder="08xx-xxxx-xxxx"
                value={form.billingCompanyPhone}
                onChange={(e) =>
                  updateField("billingCompanyPhone", e.target.value)
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-company">Nama Perusahaan</Label>
            <Input
              id="billing-company"
              placeholder="YBY NET"
              value={form.billingCompanyName}
              onChange={(e) =>
                updateField("billingCompanyName", e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-address">Alamat Perusahaan</Label>
            <Input
              id="billing-address"
              placeholder="Jl. Contoh No. 123, Bogor"
              value={form.billingCompanyAddress}
              onChange={(e) =>
                updateField("billingCompanyAddress", e.target.value)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan Pengaturan
        </Button>
      </div>
    </form>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
