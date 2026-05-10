import { mikrotikQuery } from "./pool";

type RouterOSRecord = Record<string, string>;

export async function getActiveConnections(): Promise<RouterOSRecord[]> {
  return mikrotikQuery<RouterOSRecord[]>("/ppp/active/print");
}

export async function testConnection(): Promise<{
  identity: string;
  cpuLoad: string;
  uptime: string;
}> {
  const [identity, resource] = await Promise.all([
    mikrotikQuery<RouterOSRecord[]>("/system/identity/print", undefined, 0),
    mikrotikQuery<RouterOSRecord[]>("/system/resource/print", undefined, 0),
  ]);

  return {
    identity: identity[0]?.name ?? "Unknown",
    cpuLoad: resource[0]?.["cpu-load"] ?? "-",
    uptime: resource[0]?.uptime ?? "-",
  };
}
