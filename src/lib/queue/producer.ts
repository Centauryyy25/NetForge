import { Queue, type JobsOptions } from "bullmq";
import { redisConnection } from "./connection";
import {
  MIKROTIK_QUEUE,
  NOTIFICATION_QUEUE,
  JOB_NAMES,
  type CreatePPPoEJob,
  type SuspendPPPoEJob,
  type ActivatePPPoEJob,
  type DeletePPPoEJob,
  type SetQueueJob,
  type DeleteQueueJob,
  type WhatsAppBillingJob,
  type WhatsAppOverdueReminderJob,
  type MarkOverdueJob,
} from "./jobs";

const globalForQueues = globalThis as unknown as {
  mikrotikQueue?: Queue;
  notificationQueue?: Queue;
};

export const mikrotikQueue =
  globalForQueues.mikrotikQueue ??
  new Queue(MIKROTIK_QUEUE, { connection: redisConnection });

export const notificationQueue =
  globalForQueues.notificationQueue ??
  new Queue(NOTIFICATION_QUEUE, { connection: redisConnection });

if (process.env.NODE_ENV !== "production") {
  globalForQueues.mikrotikQueue = mikrotikQueue;
  globalForQueues.notificationQueue = notificationQueue;
}

/** Standard retry policy: 3 attempts, exponential backoff starting at 2 s. */
export const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
};

export async function enqueueCreatePPPoE(data: CreatePPPoEJob) {
  return mikrotikQueue.add(JOB_NAMES.CREATE_PPPOE, data, DEFAULT_JOB_OPTS);
}

export async function enqueueSuspendPPPoE(data: SuspendPPPoEJob) {
  return mikrotikQueue.add(JOB_NAMES.SUSPEND_PPPOE, data, DEFAULT_JOB_OPTS);
}

export async function enqueueActivatePPPoE(data: ActivatePPPoEJob) {
  return mikrotikQueue.add(JOB_NAMES.ACTIVATE_PPPOE, data, DEFAULT_JOB_OPTS);
}

export async function enqueueDeletePPPoE(data: DeletePPPoEJob) {
  return mikrotikQueue.add(JOB_NAMES.DELETE_PPPOE, data, DEFAULT_JOB_OPTS);
}

export async function enqueueSetQueue(data: SetQueueJob) {
  return mikrotikQueue.add(JOB_NAMES.SET_QUEUE, data, DEFAULT_JOB_OPTS);
}

export async function enqueueDeleteQueue(data: DeleteQueueJob) {
  return mikrotikQueue.add(JOB_NAMES.DELETE_QUEUE, data, DEFAULT_JOB_OPTS);
}

export async function enqueueWhatsAppBilling(data: WhatsAppBillingJob) {
  return notificationQueue.add(
    JOB_NAMES.WHATSAPP_BILLING,
    data,
    DEFAULT_JOB_OPTS
  );
}

export async function enqueueWhatsAppOverdueReminder(data: WhatsAppOverdueReminderJob) {
  return notificationQueue.add(
    JOB_NAMES.WHATSAPP_OVERDUE_REMINDER,
    data,
    DEFAULT_JOB_OPTS
  );
}

export async function enqueueMarkOverdue(data: MarkOverdueJob = {}) {
  return notificationQueue.add(
    JOB_NAMES.MARK_OVERDUE,
    data,
    DEFAULT_JOB_OPTS
  );
}
