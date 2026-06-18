import type { FastifyInstance } from 'fastify';
import { simulateMonteCarlo, SIMULATION_PRESETS } from '@ct/simulator';
import type { TradeUpContract } from '@ct/types';
import { createJobQueue } from '@ct/workers/job-queue-factory';
import type { AnyJobQueue } from '@ct/workers/job-queue-factory';

let jobQueuePromise: Promise<AnyJobQueue> | null = null;

async function getJobQueue(): Promise<AnyJobQueue> {
  if (!jobQueuePromise) {
    jobQueuePromise = createJobQueue();
  }
  return jobQueuePromise;
}

export async function registerSimulationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/simulate/presets', async () => ({
    presets: SIMULATION_PRESETS,
  }));

  app.post('/simulate', async (req, reply) => {
    const body = req.body as {
      contract: TradeUpContract;
      iterations?: number;
      seed?: number;
      async?: boolean;
    };

    if (!body.contract) {
      return reply.status(400).send({ error: 'contract é obrigatório' });
    }

    const iterations = body.iterations ?? 10_000;

    if (body.async || iterations > 100_000) {
      const jobQueue = await getJobQueue();
      const job = await jobQueue.enqueue('simulate', {
        contract: body.contract,
        iterations,
        seed: body.seed,
      });
      return { jobId: job.id, status: job.status, message: 'Simulação enfileirada' };
    }

    return simulateMonteCarlo(body.contract, { iterations, seed: body.seed });
  });

  app.get('/simulate/jobs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const jobQueue = await getJobQueue();
    const job = await jobQueue.get(id);
    if (!job) return reply.status(404).send({ error: 'Job não encontrado' });
    return job;
  });
}
