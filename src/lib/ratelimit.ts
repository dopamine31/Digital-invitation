import IORedis from "ioredis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

type Bucket = { count: number; resetAt: number };
const memory = new Map<string, Bucket>();
let redis: IORedis | null = null;
let redisFailed = false;

function client(): IORedis | null {
  const url = env().REDIS_URL;
  if (!url || redisFailed) return null;
  if (redis) return redis;
  try {
    redis = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: false, enableOfflineQueue: false });
    redis.on("error", (error: Error) => {
      if (!redisFailed) logger.warn("Redis tidak tersedia, memakai rate limiter in-memory", { error: error.message });
      redisFailed = true;
    });
    return redis;
  } catch {
    redisFailed = true;
    return null;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  source: "redis" | "memory";
}

/** Fixed-window limiter. Fallback in-memory untuk dev tanpa Redis. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const redisClient = client();
  const now = Date.now();
  if (redisClient && !redisFailed) {
    try {
      const redisKey = `rl:${key}`;
      const count = await redisClient.incr(redisKey);
      if (count === 1) await redisClient.expire(redisKey, windowSeconds);
      const ttl = await redisClient.ttl(redisKey);
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterSeconds: count <= limit ? 0 : Math.max(1, ttl > 0 ? ttl : windowSeconds),
        source: "redis",
      };
    } catch {
      redisFailed = true;
    }
  }
  const existing = memory.get(key);
  if (!existing || existing.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0, source: "memory" };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    source: "memory",
  };
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redisClient = client();
  if (!redisClient || redisFailed) return null;
  try {
    const raw = await redisClient.get(`cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  const redisClient = client();
  if (!redisClient || redisFailed) return;
  try {
    await redisClient.set(`cache:${key}`, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    return;
  }
}

export async function cacheInvalidate(prefix: string): Promise<void> {
  const redisClient = client();
  if (redisClient && !redisFailed) {
    try {
      const keys = await redisClient.keys(`cache:${prefix}*`);
      if (keys.length > 0) await redisClient.del(...keys);
    } catch {
      return;
    }
  }
  for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key);
}
