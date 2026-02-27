import { Queue } from "bullmq";
import IORedis from "ioredis";

let redisConnection: IORedis | null = null;
const queueCache = new Map<string, Queue>();

function getRedisConnection() {
  if (redisConnection) return redisConnection;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is not configured.");

  redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableReadyCheck: false,
  });

  return redisConnection;
}

function getQueue(name: string) {
  const existing = queueCache.get(name);
  if (existing) return existing;

  const queue = new Queue(name, { connection: getRedisConnection() });
  queueCache.set(name, queue);
  return queue;
}

function createLazyQueue(name: string) {
  return new Proxy({} as Queue, {
    get(_target, property, receiver) {
      const queue = getQueue(name) as unknown as Record<PropertyKey, unknown>;
      const value = Reflect.get(queue, property, receiver);
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(queue);
      }
      return value;
    },
  });
}

export const extractionQueue = createLazyQueue("extraction");
export const enrichmentQueue = createLazyQueue("enrichment");
