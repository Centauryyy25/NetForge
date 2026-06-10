import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mikrotikQuery } from "@/lib/mikrotik/pool";

interface InterfaceTraffic {
  name: string;
  "tx-byte": string;
  "rx-byte": string;
  "tx-packet": string;
  "rx-packet": string;
}

interface TrafficSnapshot {
  timestamp: number;
  tx: number; // bytes
  rx: number; // bytes
}

// In-memory ring buffer for traffic history (last 20 data points, ~10 min at 30s interval)
const MAX_HISTORY = 20;

const globalForTraffic = globalThis as unknown as {
  _trafficHistory?: TrafficSnapshot[];
  _lastSnapshot?: { tx: number; rx: number; ts: number };
};

function getHistory(): TrafficSnapshot[] {
  if (!globalForTraffic._trafficHistory) {
    globalForTraffic._trafficHistory = [];
  }
  return globalForTraffic._trafficHistory;
}

/**
 * GET /api/bandwidth/traffic
 *
 * Returns current interface traffic rate + recent history for charting.
 * Uses counter-based delta calculation:
 *   rate = (current_bytes - previous_bytes) / elapsed_seconds
 *
 * Cache TTL 5s to prevent UI spam while still feeling responsive.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all interface stats — cache for 5s
    const interfaces = await mikrotikQuery<InterfaceTraffic[]>(
      "/interface/print",
      ["=.proplist=name,tx-byte,rx-byte,tx-packet,rx-packet"],
      5_000,
    );

    // Sum up all non-loopback interface counters
    let totalTx = 0;
    let totalRx = 0;
    for (const iface of interfaces) {
      if (iface.name === "lo") continue;
      totalTx += Number(iface["tx-byte"] || 0);
      totalRx += Number(iface["rx-byte"] || 0);
    }

    const now = Date.now();
    const last = globalForTraffic._lastSnapshot;
    let txRate = 0;
    let rxRate = 0;

    if (last) {
      const elapsedSec = (now - last.ts) / 1000;
      if (elapsedSec > 0 && elapsedSec < 120) {
        // Handle counter wraparound (unlikely but safe)
        const dtx = totalTx >= last.tx ? totalTx - last.tx : totalTx;
        const drx = totalRx >= last.rx ? totalRx - last.rx : totalRx;
        txRate = Math.round(dtx / elapsedSec);
        rxRate = Math.round(drx / elapsedSec);
      }
    }

    // Save snapshot
    globalForTraffic._lastSnapshot = { tx: totalTx, rx: totalRx, ts: now };

    // Append to history ring buffer
    const history = getHistory();
    if (!last || now - (history[history.length - 1]?.timestamp ?? 0) >= 25_000) {
      // Only push a new point every ~25s+ to avoid bloating on rapid polls
      history.push({ timestamp: now, tx: txRate, rx: rxRate });
      if (history.length > MAX_HISTORY) {
        history.shift();
      }
    }

    return NextResponse.json({
      data: {
        current: { txRate, rxRate, totalThroughput: txRate + rxRate },
        history: history.map((h) => ({
          time: new Date(h.timestamp).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          upload: h.tx,
          download: h.rx,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/bandwidth/traffic error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
