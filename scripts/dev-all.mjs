import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(name, command, args) {
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

console.log('▶ API: http://localhost:3001');
console.log('▶ Frontend: http://localhost:5173\n');

run('api', 'npm', ['run', 'dev:api']);
run('web', 'npm', ['run', 'dev:legacy']);
