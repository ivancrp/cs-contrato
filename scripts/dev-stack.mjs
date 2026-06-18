import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(name: string, command: string, args: string[]) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  child.on('exit', (code) => {
    if (code !== 0) console.error(`[${name}] encerrou com código ${code}`);
  });
  return child;
}

console.log('▶ API:      http://localhost:3001');
console.log('▶ Next.js:  http://localhost:3000\n');

run('api', 'npm', ['run', 'dev:api']);
run('web', 'npm', ['run', 'dev:web']);
