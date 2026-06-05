import "dotenv/config";
import { mikrotikWorker } from "./mikrotik.worker";
import { notificationWorker } from "./notification.worker";
import { notificationQueue } from "../lib/queue/producer";
import { JOB_NAMES } from "../lib/queue/jobs";

console.log("🚀 Starting BullMQ Background Workers...");

mikrotikWorker.on("ready", () => {
  console.log("✅ MikroTik worker is ready and listening to queue.");
});

notificationWorker.on("ready", async () => {
  console.log("✅ Notification worker is ready and listening to queue.");

  // Schedule daily overdue check at 01:00 AM
  await notificationQueue.add(
    JOB_NAMES.MARK_OVERDUE,
    {},
    { repeat: { pattern: "0 1 * * *" }, jobId: "daily-overdue-check" }
  );
  console.log("📅 Scheduled daily overdue check at 01:00 AM");
});

mikrotikWorker.on("failed", (job, err) => {
  console.error(`❌ MikroTik job ${job?.id} failed:`, err.message);
});

notificationWorker.on("failed", (job, err) => {
  console.error(`❌ Notification job ${job?.id} failed:`, err.message);
});

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nClosing workers...");
  await mikrotikWorker.close();
  await notificationWorker.close();
  process.exit(0);
});
