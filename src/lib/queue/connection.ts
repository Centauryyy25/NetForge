import IORedis from "ioredis";

// Shared Redis connection for BullMQ (lazy singleton).
// Must be lazy: during `next build` there is no Redis server,
// and eager connection floods logs with ECONNREFUSED + OOMs the build workers.
const connectionUrl = process.env.REDIS_URL || "redis://localhost:6379";

let _redis: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!_redis) {
    _redis = new IORedis(connectionUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return _redis;
}

/** @deprecated Use getRedisConnection() for new code. */
export const redisConnection = new Proxy({} as IORedis, {
  get(_target, prop, receiver) {
    const instance = getRedisConnection();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
