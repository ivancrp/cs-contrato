import { createCacheAdapter } from '@ct/common';
import { JobQueue } from './job-queue.js';
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

export { JobQueue } from './job-queue.js';

async function main() {
  const cache = await createCacheAdapter();
  const queue = new JobQueue();
  void queue;

  console.log('[workers] Fila de jobs ativa (in-memory)');
  console.log('[workers] Cache:', cache.constructor.name);
}

main().catch(console.error);
