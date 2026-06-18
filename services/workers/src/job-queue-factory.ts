import { JobQueue } from './job-queue.js';
import { RedisJobQueue } from './redis-job-queue.js';

export type AnyJobQueue = JobQueue | RedisJobQueue;

/** Fila in-memory ou Redis (Upstash/TCP) conforme REDIS_URL. */
export async function createJobQueue(): Promise<AnyJobQueue> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return new JobQueue();
  }

  try {
    const queue = new RedisJobQueue(redisUrl);
    await queue.ping();
    console.log('[workers] Fila Redis ativa');
    return queue;
  } catch (err) {
    console.warn('[workers] Redis indisponível, usando fila in-memory:', (err as Error).message);
    return new JobQueue();
  }
}
