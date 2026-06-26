import { Queue, type JobsOptions } from "bullmq";
import { getRedisConnection } from "./connection";
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

// Lazy queue singletons — avoids connecting to Redis during `next build`.
const globalForQueues = globalThis as unknown as {
  mikrotikQueue?: Queue;
  notificationQueue?: Queue;
};

function getMikrotikQueue(): Queue {
  if (!globalForQueues.mikrotikQueue) {
    globalForQueues.mikrotikQueue = new Queue(MIKROTIK_QUEUE, {
      connection: getRedisConnection(),
    });
  }
  return globalForQueues.mikrotikQueue;
}

function getNotificationQueue(): Queue {
  if (!globalForQueues.notificationQueue) {
    globalForQueues.notificationQueue = new Queue(NOTIFICATION_QUEUE, {
      connection: getRedisConnection(),
    });
  }
  return globalForQueues.notificationQueue;
}

export { getMikrotikQueue as mikrotikQueue_getter };

// Re-export as getters for backward compatibility with workers
export const mikrotikQueue = new Proxy({} as Queue, {
  get(_t, prop, recv) {
    const q = getMikrotikQueue();
    const v = Reflect.get(q, prop, recv);
    return typeof v === "function" ? v.bind(q) : v;
  },
});

export const notificationQueue = new Proxy({} as Queue, {
  get(_t, prop, recv) {
    const q = getNotificationQueue();
    const v = Reflect.get(q, prop, recv);
    return typeof v === "function" ? v.bind(q) : v;
  },
});

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
  try {
    return await notificationQueue.add(
      JOB_NAMES.WHATSAPP_BILLING,
      data,
      DEFAULT_JOB_OPTS
    );
  } catch (err) {
    console.error("Redis down, failed to enqueue WhatsApp Billing:", err);
    return null;
  }
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
