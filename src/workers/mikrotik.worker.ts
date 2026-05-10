import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { redisConnection } from "../lib/queue/connection";
import { MIKROTIK_QUEUE, JOB_NAMES } from "../lib/queue/jobs";
import {
  createPPPoEUser,
  suspendPPPoEUser,
  activatePPPoEUser,
  deletePPPoEUser
} from "../lib/mikrotik/pppoe";
import { setSimpleQueue, deleteSimpleQueue } from "../lib/mikrotik/queue";
import { db } from "../db";
import { customers } from "../db/schema/customers";

export const mikrotikWorker = new Worker(
  MIKROTIK_QUEUE,
  async (job) => {
    console.log(`[MikroTik Worker] Processing job ${job.id} of type ${job.name}`);
    
    switch (job.name) {
      case JOB_NAMES.CREATE_PPPOE: {
        const { username, password, profile } = job.data;
        if (!password) {
          throw new Error("[CREATE_PPPOE] missing password in job payload");
        }
        await createPPPoEUser(username, password, profile);
        return { ok: true };
      }

      case JOB_NAMES.SUSPEND_PPPOE: {
        await suspendPPPoEUser(job.data.username);
        return { ok: true };
      }

      case JOB_NAMES.ACTIVATE_PPPOE: {
        await activatePPPoEUser(job.data.username);
        return { ok: true };
      }

      case JOB_NAMES.DELETE_PPPOE: {
        await deletePPPoEUser(job.data.username);
        return { ok: true };
      }

      case JOB_NAMES.SET_QUEUE: {
        const { name, target, maxLimit } = job.data;
        await setSimpleQueue(name, target, maxLimit);
        return { ok: true };
      }

      case JOB_NAMES.DELETE_QUEUE: {
        await deleteSimpleQueue(job.data.name);
        return { ok: true };
      }

      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process sequentially to not overload MikroTik API
  }
);

interface CreatePPPoEJobLike {
  name: string;
  data: { customerId?: number };
  attemptsMade: number;
  opts: { attempts?: number };
}

export async function handleCreatePPPoESuccess(
  job: CreatePPPoEJobLike
): Promise<void> {
  if (job.name !== JOB_NAMES.CREATE_PPPOE) return;
  const customerId = job.data.customerId;
  if (!customerId) return;
  await db
    .update(customers)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(customers.id, customerId));
}

export async function handleCreatePPPoEFailure(
  job: CreatePPPoEJobLike | null | undefined
): Promise<void> {
  if (!job || job.name !== JOB_NAMES.CREATE_PPPOE) return;
  const maxAttempts = job.opts.attempts ?? 1;
  if (job.attemptsMade < maxAttempts) return;
  const customerId = job.data.customerId;
  if (!customerId) return;
  await db
    .update(customers)
    .set({ status: "provisioning_failed", updatedAt: new Date() })
    .where(eq(customers.id, customerId));
}

mikrotikWorker.on("completed", (job) =>
  handleCreatePPPoESuccess(job as unknown as CreatePPPoEJobLike)
);
mikrotikWorker.on("failed", (job) =>
  handleCreatePPPoEFailure(job as unknown as CreatePPPoEJobLike)
);
