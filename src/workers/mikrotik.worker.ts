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
        const result = await createPPPoEUser(username, password, profile);
        if (!result.success) throw new Error(result.error);
        return result;
      }
      
      case JOB_NAMES.SUSPEND_PPPOE: {
        const { username } = job.data;
        const result = await suspendPPPoEUser(username);
        if (!result.success) throw new Error(result.error);
        return result;
      }
      
      case JOB_NAMES.ACTIVATE_PPPOE: {
        const { username } = job.data;
        const result = await activatePPPoEUser(username);
        if (!result.success) throw new Error(result.error);
        return result;
      }
      
      case JOB_NAMES.DELETE_PPPOE: {
        const { username } = job.data;
        const result = await deletePPPoEUser(username);
        if (!result.success) throw new Error(result.error);
        return result;
      }
      
      case JOB_NAMES.SET_QUEUE: {
        const { name, target, maxLimit } = job.data;
        const result = await setSimpleQueue(name, target, maxLimit);
        if (!result.success) throw new Error(result.error);
        return result;
      }
      
      case JOB_NAMES.DELETE_QUEUE: {
        const { name } = job.data;
        const result = await deleteSimpleQueue(name);
        if (!result.success) throw new Error(result.error);
        return result;
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
