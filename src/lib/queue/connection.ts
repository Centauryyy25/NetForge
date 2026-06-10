import IORedis from "ioredis";

// Shared Redis connection for BullMQ
// Reusing connection is highly recommended by BullMQ
const connectionUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisConnection = new IORedis(connectionUrl, {
  maxRetriesPerRequest: null,
});
