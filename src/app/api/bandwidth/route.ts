import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mikrotikQuery } from "@/lib/mikrotik/pool";
import { db } from "@/db";
import { customers } from "@/db/schema/customers";
import { eq } from "drizzle-orm";

interface PPPoEActive {
  name: string;
  address: string;
  "caller-id": string;
  uptime: string;
  service: string;
  ".id": string;
}

interface SimpleQueue {
  name: string;
  target: string;
  "max-limit": string;
  ".id": string;
}

interface InterfaceCounter {
  name: string;
  "rx-byte": string;
  "tx-byte": string;
}

interface Connection {
  name: string;
  customerName: string;
  address: string;
  callerId: string;
  uptime: string;
  service: string;
  maxLimit: string;
  txRate: number; // upload (client → router)
  rxRate: number; // download (router → client)
  status: "online" | "offline";
}

// Per-PPPoE byte snapshot for delta-based rate calculation (survives HMR).
const globalForBw = globalThis as unknown as {
  _pppoeByteSnapshots?: Map<string, { tx: number; rx: number; ts: number }>;
};

function getSnapshots(): Map<string, { tx: number; rx: number; ts: number }> {
  if (!globalForBw._pppoeByteSnapshots) {
    globalForBw._pppoeByteSnapshots = new Map();
  }
  return globalForBw._pppoeByteSnapshots;
}

/** Dynamic PPPoE interfaces are named "<pppoe-USERNAME>"; strip to the bare username. */
function stripPppoeName(name: string): string {
  return name.replace(/^<pppoe-/, "").replace(/>$/, "");
}

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch active sessions, dynamic-interface byte counters, and queues (for max-limit).
    // Single pooled connection, sequential commands. Cache 10s to avoid hammering MikroTik.
    const [activeUsers, interfaces, queues] = await Promise.all([
      mikrotikQuery<PPPoEActive[]>("/ppp/active/print", undefined, 10_000),
      mikrotikQuery<InterfaceCounter[]>(
        "/interface/print",
        ["=.proplist=name,rx-byte,tx-byte"],
        10_000,
      ),
      mikrotikQuery<SimpleQueue[]>(
        "/queue/simple/print",
        ["=.proplist=name,target,max-limit"],
        10_000,
      ),
    ]);

    // Byte counters keyed by PPPoE username (from the dynamic "<pppoe-…>" interfaces).
    const counterMap = new Map<string, { tx: number; rx: number }>();
    for (const iface of interfaces) {
      if (!iface.name.startsWith("<pppoe-")) continue;
      counterMap.set(stripPppoeName(iface.name), {
        tx: Number(iface["tx-byte"] || 0),
        rx: Number(iface["rx-byte"] || 0),
      });
    }

    // max-limit lookup: queue name may be "<pppoe-USERNAME>" or match by target IP.
    const queueByName = new Map<string, SimpleQueue>();
    const queueByTarget = new Map<string, SimpleQueue>();
    for (const q of queues) {
      queueByName.set(stripPppoeName(q.name), q);
      if (q.target) {
        // target can be "1.2.3.4/32" or comma-separated; key by the bare IP
        for (const t of q.target.split(",")) {
          queueByTarget.set(t.split("/")[0].trim(), q);
        }
      }
    }

    // Compute per-session rate as a delta of byte counters vs. the previous poll.
    const snapshots = getSnapshots();
    const now = Date.now();
    const rateFor = (username: string): { txRate: number; rxRate: number } => {
      const cur = counterMap.get(username);
      if (!cur) return { txRate: 0, rxRate: 0 };
      const prev = snapshots.get(username);
      snapshots.set(username, { tx: cur.tx, rx: cur.rx, ts: now });
      if (!prev) return { txRate: 0, rxRate: 0 }; // warm-up: first sample has no baseline
      const elapsedSec = (now - prev.ts) / 1000;
      if (elapsedSec <= 0 || elapsedSec >= 120) return { txRate: 0, rxRate: 0 };
      // Counter reset (interface re-created) → fall back to current value.
      const dtx = cur.tx >= prev.tx ? cur.tx - prev.tx : cur.tx;
      const drx = cur.rx >= prev.rx ? cur.rx - prev.rx : cur.rx;
      // On a PPPoE interface (router's view): tx-byte = sent to client = download,
      // rx-byte = received from client = upload.
      return {
        txRate: Math.round(drx / elapsedSec), // upload
        rxRate: Math.round(dtx / elapsedSec), // download
      };
    };

    const activeByName = new Map<string, PPPoEActive>();
    for (const u of activeUsers) activeByName.set(u.name, u);

    // Registered PPPoE customers form the universe of rows (online + offline).
    const allCustomers = await db.query.customers.findMany({
      columns: { customerId: true, name: true, pppoeUsername: true },
      where: eq(customers.status, "active"),
    });

    const connections: Connection[] = [];
    const seen = new Set<string>();

    for (const c of allCustomers) {
      const username = c.pppoeUsername;
      if (!username) continue;
      seen.add(username);
      const sess = activeByName.get(username);

      if (sess) {
        const { txRate, rxRate } = rateFor(username);
        const queue =
          queueByName.get(username) ?? queueByTarget.get(sess.address);
        connections.push({
          name: username,
          customerName: c.name,
          address: sess.address,
          callerId: sess["caller-id"] ?? "-",
          uptime: sess.uptime,
          service: sess.service,
          maxLimit: queue?.["max-limit"] ?? "-",
          txRate,
          rxRate,
          status: "online",
        });
      } else {
        connections.push({
          name: username,
          customerName: c.name,
          address: "-",
          callerId: "-",
          uptime: "-",
          service: "-",
          maxLimit: "-",
          txRate: 0,
          rxRate: 0,
          status: "offline",
        });
      }
    }

    // Active sessions without a matching DB customer (e.g. created manually on the router).
    for (const u of activeUsers) {
      if (seen.has(u.name)) continue;
      const { txRate, rxRate } = rateFor(u.name);
      const queue = queueByName.get(u.name) ?? queueByTarget.get(u.address);
      connections.push({
        name: u.name,
        customerName: u.name,
        address: u.address,
        callerId: u["caller-id"] ?? "-",
        uptime: u.uptime,
        service: u.service,
        maxLimit: queue?.["max-limit"] ?? "-",
        txRate,
        rxRate,
        status: "online",
      });
    }

    // Drop snapshots for sessions that are no longer active (prevent unbounded growth).
    for (const key of snapshots.keys()) {
      if (!activeByName.has(key)) snapshots.delete(key);
    }

    // Online first, then by name.
    connections.sort((a, b) => {
      if (a.status !== b.status) return a.status === "online" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const online = connections.filter((c) => c.status === "online");
    const totalTx = online.reduce((sum, c) => sum + c.txRate, 0);
    const totalRx = online.reduce((sum, c) => sum + c.rxRate, 0);

    return NextResponse.json({
      data: {
        connections,
        summary: {
          online: online.length,
          offline: connections.length - online.length,
          totalCustomers: connections.length,
          totalTx,
          totalRx,
          totalThroughput: totalTx + totalRx,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/bandwidth error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
