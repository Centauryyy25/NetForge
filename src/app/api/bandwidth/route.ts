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
  bytes: string;
  rate: string;
  ".id": string;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch PPPoE active + simple queues in parallel (single pooled connection, but sequential commands)
    // Cache 10s to avoid hammering MikroTik on rapid refreshes
    const [activeUsers, queues] = await Promise.all([
      mikrotikQuery<PPPoEActive[]>("/ppp/active/print", undefined, 10_000),
      mikrotikQuery<SimpleQueue[]>("/queue/simple/print", undefined, 10_000),
    ]);

    // Build queue lookup by name for O(1) matching
    const queueMap = new Map<string, SimpleQueue>();
    for (const q of queues) {
      queueMap.set(q.name, q);
    }

    // Get total registered customers (with PPPoE username) for offline count
    const allCustomers = await db.query.customers.findMany({
      columns: { pppoeUsername: true, status: true },
      where: eq(customers.status, "active"),
    });
    const totalPppoeCustomers = allCustomers.filter((c) => c.pppoeUsername).length;

    // Merge active users with their queue info
    const connections = activeUsers.map((user) => {
      const queue = queueMap.get(user.name);
      // rate is "tx/rx" in bytes per second
      const [txRate, rxRate] = (queue?.rate ?? "0/0").split("/").map(Number);

      return {
        name: user.name,
        address: user.address,
        callerId: user["caller-id"] ?? "-",
        uptime: user.uptime,
        service: user.service,
        maxLimit: queue?.["max-limit"] ?? "-",
        txRate: txRate || 0,  // upload (from client perspective)
        rxRate: rxRate || 0,  // download
      };
    });

    // Calculate totals
    const totalTx = connections.reduce((sum, c) => sum + c.txRate, 0);
    const totalRx = connections.reduce((sum, c) => sum + c.rxRate, 0);

    return NextResponse.json({
      data: {
        connections,
        summary: {
          online: activeUsers.length,
          offline: Math.max(0, totalPppoeCustomers - activeUsers.length),
          totalCustomers: totalPppoeCustomers,
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
