import { createCacheAdapter } from '@ct/common';
import { createJobQueue } from './job-queue-factory.js';
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

async function main() {
  const cache = await createCacheAdapter();
  const queue = await createJobQueue();
  await queue.ping();

  console.log('[workers] Fila ativa:', queue.constructor.name);
  console.log('[workers] Cache:', cache.constructor.name);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}
