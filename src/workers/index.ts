if (process.env.NODE_ENV !== "production") {
  await import("dotenv/config");
}

import { mikrotikWorker } from "./mikrotik.worker";
import { notificationWorker } from "./notification.worker";
import { notificationQueue } from "../lib/queue/producer";
import { JOB_NAMES } from "../lib/queue/jobs";
import { workerLogger } from "../lib/logger";

const log = workerLogger;

log.info("Starting BullMQ background workers");

mikrotikWorker.on("ready", () => {
  log.info("MikroTik worker is ready");
});

notificationWorker.on("ready", async () => {
  log.info("Notification worker is ready");

  // Schedule daily overdue check at 01:00 AM
  await notificationQueue.add(
    JOB_NAMES.MARK_OVERDUE,
    {},
    { repeat: { pattern: "0 1 * * *" }, jobId: "daily-overdue-check" }
  );
  log.info("Scheduled daily overdue check at 01:00 AM");
});

mikrotikWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "MikroTik job failed");
});

notificationWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "Notification job failed");
});

// Handle graceful shutdown (SIGINT for local, SIGTERM for Docker)
async function shutdown() {
  log.info("Shutting down workers");
  await mikrotikWorker.close();
  await notificationWorker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
