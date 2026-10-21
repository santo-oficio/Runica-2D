import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const allowedPages = new Set([
  'calibrate-submundos.html',
  'calibrate-submundos-text.html',
  'calibrate-mapamundi.html',
  'calibrate-tienda-nombre.html',
  'calibrate-pedestal.html',
  'calibrate-creditos.html',
  'calibrate-config.html',
  'calibrate-instructions.html',
  // páginas de juego para demos de prueba en desktop (p.ej. demo=bonus)
  'submundo.html',
  'bonus.html',
  'shop.html',
  // demos de flujo completo (boss de mundo → mapamundi, boss final)
  'demo-boss-run.html',
  'demo-ultimo-boss.html',
  'demo-boss-final.html',
]);
const page = process.argv[2] ?? '';
// el argumento puede llevar query: "submundo.html?world=AGUA&demo=bonus"
const pageName = page.split('?')[0];
if (!allowedPages.has(pageName)) {
  console.error('Choose a supported calibrator/demo page.');
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
