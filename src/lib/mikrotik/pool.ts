import { RouterOSAPI } from "node-routeros";
import { getMikroTikConfig } from "@/lib/settings";

/**
 * MikroTik Connection Pool
 *
 * - Reuses a single connection across requests (no spam)
 * - Auto-reconnects on failure
 * - Server-side response cache with TTL (rate-limit protection)
 * - Safe for Next.js HMR via globalThis singleton
 */

interface PoolState {
  conn: RouterOSAPI | null;
  connected: boolean;
  lastConnect: number;
  cache: Map<string, { data: unknown; ts: number }>;
}

const RECONNECT_COOLDOWN_MS = 5_000; // min 5s between reconnect attempts
const DEFAULT_CACHE_TTL_MS = 10_000; // cache responses for 10s

const globalForPool = globalThis as unknown as { _mikrotikPool?: PoolState };

function getPool(): PoolState {
  if (!globalForPool._mikrotikPool) {
    globalForPool._mikrotikPool = {
      conn: null,
      connected: false,
      lastConnect: 0,
      cache: new Map(),
    };
  }
  return globalForPool._mikrotikPool;
}

/** Get or create a connected RouterOS API instance */
async function getConnection(): Promise<RouterOSAPI> {
  const pool = getPool();

  // Reuse existing live connection
  if (pool.conn && pool.connected) {
    return pool.conn;
  }

  // Rate-limit reconnect attempts
  const now = Date.now();
  if (now - pool.lastConnect < RECONNECT_COOLDOWN_MS) {
    throw new Error("MikroTik reconnect cooldown — coba lagi beberapa detik");
  }

  pool.lastConnect = now;

  // Clean up old connection
  if (pool.conn) {
    try { pool.conn.close(); } catch { /* ignore */ }
    pool.conn = null;
    pool.connected = false;
  }

  const config = await getMikroTikConfig();
  if (!config.host || !config.user) {
    throw new Error("MikroTik belum dikonfigurasi. Atur di menu Pengaturan.");
  }

  const conn = new RouterOSAPI({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    timeout: 10,
  });

  await conn.connect();
  pool.conn = conn;
  pool.connected = true;

  // Listen for disconnects to mark pool as stale
  conn.on("error", () => {
    pool.connected = false;
    pool.conn = null;
  });
  conn.on("close", () => {
    pool.connected = false;
    pool.conn = null;
  });

  return conn;
}

/**
 * Execute a RouterOS command with connection reuse and response caching.
 *
 * @param command  RouterOS command path, e.g. "/ppp/active/print"
 * @param args     Optional command arguments
 * @param cacheTtl Cache TTL in ms (default 10s). Pass 0 to skip cache.
 */
export async function mikrotikQuery<T = Record<string, string>[]>(
  command: string,
  args?: string[],
  cacheTtl = DEFAULT_CACHE_TTL_MS,
): Promise<T> {
  const pool = getPool();
  const cacheKey = `${command}|${(args ?? []).join(",")}`;

  // Check cache
  if (cacheTtl > 0) {
    const cached = pool.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < cacheTtl) {
      return cached.data as T;
    }
  }

  // Execute with auto-retry once on connection failure
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const conn = await getConnection();
      const result = args
        ? await conn.write(command, args)
        : await conn.write(command);

      // Store in cache
      if (cacheTtl > 0) {
        pool.cache.set(cacheKey, { data: result, ts: Date.now() });
      }

      return result as T;
    } catch (err) {
      lastError = err;
      // Mark connection as dead so next attempt reconnects
      pool.connected = false;
      pool.conn = null;

      // Only retry once
      if (attempt === 0) {
        // Reset cooldown so retry can reconnect immediately
        pool.lastConnect = 0;
        continue;
      }
    }
  }

  throw lastError;
}

/** Invalidate all cached responses */
export function clearMikroTikCache() {
  getPool().cache.clear();
}

/** Close the pooled connection (useful for graceful shutdown) */
export function closeMikroTikPool() {
  const pool = getPool();
  if (pool.conn) {
    try { pool.conn.close(); } catch { /* ignore */ }
    pool.conn = null;
    pool.connected = false;
  }
  pool.cache.clear();
}
