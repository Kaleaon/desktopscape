import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== PEORIA 4K GAUSSIAN SPLAT DESKTOP ENGINE - EXECUTABLE BUILD VALIDATOR ===');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

// 1. Verify Package Configuration
console.log(`[1/3] Checking Package Name: ${pkg.name} v${pkg.version}`);
console.log(`[1/3] Target Main Entry: ${pkg.main}`);

if (!pkg.build || !pkg.build.win) {
  console.error('Error: Missing electron-builder "win" build configuration!');
  process.exit(1);
}

// 2. Verify File Dependencies
const requiredFiles = [
  'package.json',
  'electron/main.js',
  'electron/preload.js',
  'src/index.html',
  'src/styles.css',
  'src/js/app.js',
  'src/js/splatRenderer.js',
  'src/js/peoriaScenes.js',
  'src/js/environmentEngine.js',
  'src/js/youtubePipeline.js',
  'src/js/youtubePipelineBackend.js',
  'assets/icon.png'
];

console.log('[2/3] Verifying core source files...');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Missing required file: ${file}`);
    process.exit(1);
  }
});
console.log('✓ All core source files verified successfully.');

// 3. Electron-Builder Exe Configuration Test
console.log('[3/3] Validating Windows .EXE packaging metadata...');
console.log(`  - Product Name: ${pkg.build.productName}`);
console.log(`  - App ID: ${pkg.build.appId}`);
console.log(`  - Windows Targets: ${pkg.build.win.target.join(', ')}`);
console.log('✓ Executable build target ready!');

console.log('\nSUCCESS: Executable packaging check passed. The application is configured to build Windows .exe packages via electron-builder.');
