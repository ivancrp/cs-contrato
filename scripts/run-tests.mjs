import { execSync } from 'node:child_process';

const packages = ['@ct/contracts', '@ct/engine', '@ct/simulator', '@ct/optimizer', '@ct/api'];

for (const pkg of packages) {
  console.log(`\n▶ Testing ${pkg}...`);
  execSync(`npm run test -w ${pkg}`, { stdio: 'inherit' });
}

console.log('\n✓ All tests passed.');
