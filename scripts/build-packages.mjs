import { execSync } from 'node:child_process';

const packages = [
  '@ct/types',
  '@ct/common',
  '@ct/contracts',
  '@ct/engine',
  '@ct/simulator',
  '@ct/optimizer',
  '@ct/pricing',
  '@ct/parser',
  '@ct/workers',
  '@ct/api',
];

for (const pkg of packages) {
  console.log(`\n▶ Building ${pkg}...`);
  execSync(`npm run build -w ${pkg}`, { stdio: 'inherit' });
}

console.log('\n✓ All packages built successfully.');
