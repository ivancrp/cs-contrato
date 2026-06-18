import { simulateMonteCarlo } from '@ct/simulator';
import type { TradeUpContract } from '@ct/types';
import type { Job, JobType } from './job-queue.js';

const QUEUE_KEY = 'ct:jobs:queue';
const JOB_PREFIX = 'ct:jobs:';

interface RedisStore {
  ping(): Promise<string>;
  lpush(key: string, value: string): Promise<number>;
  rpop(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
}

function createStore(url: string): RedisStore {
  if (url.startsWith('https://')) {
    return createUpstashStore(url);
  }
  throw new Error('REDIS_URL TCP não suportado ainda — use Upstash REST');
}

function createUpstashStore(restUrl: string): RedisStore {
  const token = process.env.REDIS_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!token) {
    throw new Error('REDIS_TOKEN ou UPSTASH_REDIS_REST_TOKEN necessário para Upstash');
  }

  async function command<T>(cmd: string[]): Promise<T> {
    const res = await fetch(restUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(cmd),
    });
    if (!res.ok) throw new Error(`Redis REST: ${res.status}`);
    const data = (await res.json()) as { result?: T };
    return data.result as T;
  }

  return {
    ping: () => command<string>(['PING']),
    lpush: (key, value) => command<number>(['LPUSH', key, value]),
    rpop: (key) => command<string | null>(['RPOP', key]),
    set: (key, value) => command(['SET', key, value]),
    get: (key) => command<string | null>(['GET', key]),
  };
}

export class RedisJobQueue {
  private store: RedisStore;
  private processing = false;

  constructor(redisUrl: string) {
    this.store = createStore(redisUrl);
  }

  async ping(): Promise<void> {
    await this.store.ping();
  }

  async enqueue<T>(type: JobType, payload: T): Promise<Job<T>> {
    const job: Job<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await this.store.set(`${JOB_PREFIX}${job.id}`, JSON.stringify(job));
    await this.store.lpush(QUEUE_KEY, job.id);
    void this.processNext();
    return job;
  }

  async get(id: string): Promise<Job | undefined> {
    const raw = await this.store.get(`${JOB_PREFIX}${id}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as Job;
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (true) {
        const jobId = await this.store.rpop(QUEUE_KEY);
        if (!jobId) break;

        const job = await this.get(jobId);
        if (!job) continue;

        job.status = 'processing';
        await this.store.set(`${JOB_PREFIX}${job.id}`, JSON.stringify(job));

        try {
          job.result = await this.execute(job);
          job.status = 'completed';
        } catch (err) {
          job.status = 'failed';
          job.error = (err as Error).message;
        }

        await this.store.set(`${JOB_PREFIX}${job.id}`, JSON.stringify(job));
      }
    } finally {
      this.processing = false;
    }
  }

  private async execute(job: Job): Promise<unknown> {
    switch (job.type) {
      case 'simulate': {
        const { contract, iterations, seed } = job.payload as {
          contract: TradeUpContract;
          iterations: number;
          seed?: number;
        };
        return simulateMonteCarlo(contract, { iterations, seed });
      }
      case 'optimize':
        return { message: 'Otimização assíncrona — em desenvolvimento' };
      case 'scan_prices':
        return { message: 'Scan de preços — Fase 3' };
      default:
        throw new Error(`Tipo de job desconhecido: ${job.type}`);
    }
  }
}
