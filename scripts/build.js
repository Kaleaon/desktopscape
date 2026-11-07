import { execSync } from 'node:child_process';

console.log('Running build sequence...');
execSync('node scripts/generateAssets.js', { stdio: 'inherit' });
execSync('node scripts/packageExe.js', { stdio: 'inherit' });
console.log('Build sequence completed successfully.');
