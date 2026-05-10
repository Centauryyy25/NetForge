import { Worker } from "bullmq";
import { redisConnection } from "../lib/queue/connection";
import { MIKROTIK_QUEUE, JOB_NAMES } from "../lib/queue/jobs";
import { 
  createPPPoEUser, 
  suspendPPPoEUser, 
  activatePPPoEUser, 
  deletePPPoEUser 
} from "../lib/mikrotik/pppoe";
import { setSimpleQueue, deleteSimpleQueue } from "../lib/mikrotik/queue";

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
