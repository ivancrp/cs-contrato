import { simulateMonteCarlo } from '@ct/simulator';
import type { TradeUpContract } from '@ct/types';

export type JobType = 'optimize' | 'simulate' | 'scan_prices';

export interface Job<T = unknown> {
  id: string;
  type: JobType;
  payload: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  result?: unknown;
  error?: string;
}

export class JobQueue {
  private jobs = new Map<string, Job>();
  private queue: string[] = [];
  private processing = false;

  enqueue<T>(type: JobType, payload: T): Job<T> {
    const job: Job<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job as Job);
    this.queue.push(job.id);
    void this.processNext();
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const jobId = this.queue.shift()!;
    const job = this.jobs.get(jobId);
    if (!job) {
      this.processing = false;
      return;
    }

    job.status = 'processing';
    try {
      job.result = await this.execute(job);
      job.status = 'completed';
    } catch (err) {
      job.status = 'failed';
      job.error = (err as Error).message;
    }

    this.processing = false;
    if (this.queue.length > 0) void this.processNext();
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
