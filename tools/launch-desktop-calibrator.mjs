import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const allowedPages = new Set([
  'calibrate-submundos.html',
  'calibrate-submundos-text.html',
  'calibrate-mapamundi.html',
]);
const page = process.argv[2];
if (!allowedPages.has(page)) {
  console.error('Choose a supported subworld calibrator page.');
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const electronPath = require('electron');
const env = { ...process.env, RUNIKA_START_PAGE: page };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
