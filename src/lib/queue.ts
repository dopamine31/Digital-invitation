import IORedis from "ioredis";
import { Queue, Worker, type Job, type JobsOptions } from "bullmq";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const QUEUE_NAME = "rasa-jobs" as const;
export type JobKind =
  | "blast.process" | "blast.message" | "reminder.process"
  | "notification.send" | "webhook.deliver";

export interface JobPayload {
  kind: JobKind;
  [key: string]: unknown;
}

let connection: IORedis | null = null;
let queue: Queue<JobPayload> | null = null;
let unavailable = false;

function getConnection(): IORedis | null {
  const url = env().REDIS_URL;
  if (!url || unavailable) return null;
  if (connection) return connection;
  try {
    connection = new IORedis(url, { maxRetriesPerRequest: null, enableOfflineQueue: true });
    connection.on("error", (error: Error) => logger.warn("Redis queue error", { error: error.message }));
    return connection;
  } catch {
    unavailable = true;
    return null;
  }
}

function getQueue(): Queue<JobPayload> | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!queue) queue = new Queue<JobPayload>(QUEUE_NAME, { connection: conn });
  return queue;
}

/**
 * Enqueue job. Tanpa Redis (dev lokal) job diproses inline agar alur tetap
 * berfungsi penuh; di produksi selalu lewat BullMQ (retry + backoff + throttle).
 */
export async function enqueue(payload: JobPayload, options: JobsOptions = {}): Promise<string> {
  const q = getQueue();
  if (!q) {
    logger.info("queue inline (Redis tidak dikonfigurasi)", { kind: payload.kind });
    const { processJob } = await import("@/server/jobs");
    try {
      await processJob(payload);
    } catch (error) {
      // Antrean inline bersifat fire-and-forget: kegagalan pengiriman webhook/email
      // tidak boleh membatalkan transaksi utama (RSVP, check-in, dll).
      logger.warn("job inline gagal", { kind: payload.kind, error: error instanceof Error ? error.message : "unknown" });
    }
    return `inline:${Date.now()}`;
  }
  const job = await q.add(payload.kind, payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 500,
    removeOnFail: 1_000,
    ...options,
  });
  return job.id ?? "";
}

export function createWorker(): Worker<JobPayload> | null {
  const conn = getConnection();
  if (!conn) return null;
  const worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job: Job<JobPayload>) => {
      const { processJob } = await import("@/server/jobs");
      await processJob(job.data);
    },
    { connection: conn, concurrency: env().WORKER_CONCURRENCY },
  );
  worker.on("failed", (job, error) => logger.error("job gagal", { jobId: job?.id, kind: job?.data.kind, error: error.message }));
  worker.on("completed", (job) => logger.debug("job selesai", { jobId: job.id, kind: job.data.kind }));
  return worker;
}

export function queueAvailable(): boolean {
  return Boolean(env().REDIS_URL) && !unavailable;
}
