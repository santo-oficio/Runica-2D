// Graba una demo autopilotada del juego (?auto=1 encadena el flujo real):
//   menú → mapamundi → submundo → nivel (lo juega el solver) → victoria →
//   desbloqueo de isla (+ vuelo de la casa si toca) → bonus → mapamundi.
//
// Uso:
//   node tools/record-demo.mjs [maxSegundos]      → recordings/runika-demo-<ts>.mp4
//   npm run record:demo
//
// Se abre una ventana de Chrome 1920×1080 que se juega y graba sola vía
// CDP screencast (headless no soporta startScreencast); los frames se
// ensamblan con ffmpeg respetando el timestamp real de cada uno.
// El servidor de grabación corre en :3017 con un db-dir temporal sembrado
// (nunca toca db/player.json). El vídeo sale sin audio (CDP no lo captura);
// la música se puede superponer en post con cualquier pista de assets/music/.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 3017;                 // servidor propio — no toca el dev :3000
const CDP_PORT = 9360;
const MAX_S = Number(process.argv[2]) || 200;
const FRAME_DIR = join(ROOT, '.tmp_chk', 'rec_frames');
const REC_DB = join(ROOT, '.tmp_chk', 'rec_db');
const OUT_DIR = join(ROOT, 'recordings');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 1) Servidor dedicado con su propio db-dir sembrado. db.ts cachea la
// partida en memoria al arrancar (loadDb), así que el seed se escribe
// ANTES de levantarlo y nunca se toca db/player.json real.
let serverProc = null;
const SEED = {
  player: {
    playerId: 'player-1', currentWorld: 1, currentSubLevel: 3,
    totalStagesCompleted: 2, updatedAt: Date.now(), gold: 1855,
    lastWorld: 'INFRAMUNDO',
    // completed [0,1] + last 2 → getStartLevel entra en la isla 2 (la
    // pendiente); ganarla desbloquea la 3 y el nodo de tienda (unlockAfter 3)
    worldProgress: { INFRAMUNDO: { completed: [0, 1], last: 2, shopGone: [], shopVisited: [] } },
    gameLevel: 3, started: true, playerName: 'SABELA', avatarIndex: 3,
  },
  assignments: {
    'map:INFRAMUNDO:0': { current: null, completed: ['l3-s1'] },
    'map:INFRAMUNDO:1': { current: null, completed: ['l3-s2'] },
    'map:INFRAMUNDO:2': { current: 'l3-s3', completed: [] },
  },
};
async function ensureServer() {
  rmSync(REC_DB, { recursive: true, force: true });
  mkdirSync(REC_DB, { recursive: true });
  // INFRAMUNDO con niveles 1-2 hechos → ganar el 3 dispara el desbloqueo
  // de isla + el vuelo de la casa + el bonus: el showcase completo.
  writeFileSync(join(REC_DB, 'player.json'), JSON.stringify(SEED, null, 2));
  const settings = join(ROOT, 'db', 'settings.json');
  if (existsSync(settings)) copyFileSync(settings, join(REC_DB, 'settings.json'));
  console.log('· levantando servidor de grabación en :' + PORT + ' (save sembrado)');
  serverProc = spawn('npx', ['tsx', 'server.ts'], {
    cwd: ROOT, stdio: 'ignore', shell: true, detached: false,
    env: { ...process.env, RUNIKA_PORT: String(PORT), RUNIKA_DB_DIR: REC_DB, RUNIKA_BANK_DIR: join(ROOT, 'db') },
  });
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    try { if ((await fetch(`http://localhost:${PORT}/api/version`)).ok) return; } catch {}
  }
  throw new Error('el servidor no respondió en :' + PORT);
}

// 3) Chrome headless + CDP
let chrome = null, ws = null, id = 0;
const pend = new Map();
const frames = [];           // {file, ts}
let autoDoneAt = 0;

const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});

async function run() {
  await ensureServer();
  mkdirSync(FRAME_DIR, { recursive: true });
  rmSync(FRAME_DIR, { recursive: true, force: true });
  mkdirSync(FRAME_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  // Chrome en ventana real: Page.startScreencast no está soportado en
  // headless=new ("Not attached to an active page") — en ventana, basta
  // activar la pestaña por el websocket del browser una vez.
  chrome = spawn(CHROME, [
    `--remote-debugging-port=${CDP_PORT}`, '--no-first-run',
    `--user-data-dir=${process.env.TEMP}/runika-rec`, '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', '--window-size=1960,1150',
    '--window-position=0,0', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  await sleep(2500);

  const tabs = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
  const page = tabs.find(t => t.type === 'page');
  const ver = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  const bws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise(r => bws.onopen = r);
  let bid = 1000;
  const bsend = (method, params = {}) => new Promise(r => {
    const i = ++bid;
    const h = m => { const d = JSON.parse(m.data); if (d.id === i) { bws.removeEventListener('message', h); r(d.result); } };
    bws.addEventListener('message', h);
    bws.send(JSON.stringify({ id: i, method, params }));
  });
  await bsend('Target.activateTarget', { targetId: page.id });

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  ws.onmessage = async m => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); return; }
    if (d.method === 'Page.screencastFrame') {
      const { sessionId, data, metadata } = d.params;
      const name = `f${String(frames.length).padStart(5, '0')}.jpg`;
      writeFileSync(join(FRAME_DIR, name), Buffer.from(data, 'base64'));
      frames.push({ file: name, ts: metadata.timestamp });
      send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  // El viewport debe ser 1920×1080 reales: NO usar
  // Emulation.setDeviceMetricsOverride — la página emulada deja de ser
  // "active" y Page.startScreencast falla. En su lugar se redimensiona la
  // ventana real hasta que innerWidth/innerHeight den el lienzo exacto.
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(600);
  for (let i = 0; i < 8; i++) {
    const sz = await send('Runtime.evaluate', { expression: 'innerWidth+"x"+innerHeight', returnByValue: true });
    const [w, h] = (sz?.result?.value || '0x0').split('x').map(Number);
    if (w === 1920 && h === 1080) break;
    const win = await bsend('Browser.getWindowForTarget', { targetId: page.id });
    await bsend('Browser.setWindowBounds', {
      windowId: win.windowId,
      bounds: { width: win.bounds.width + (1920 - w), height: win.bounds.height + (1080 - h) },
    });
    await sleep(400);
  }
  const fin = await send('Runtime.evaluate', { expression: 'innerWidth+"x"+innerHeight', returnByValue: true });
  console.log('· viewport:', fin?.result?.value);

  console.log('· navegando a menu.html?auto=1 — el juego se juega solo');
  await send('Page.navigate', { url: `http://localhost:${PORT}/menu.html?auto=1` });
  await sleep(800);
  const sc = await send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1 });
  if (!sc) console.log('· aviso: startScreencast sin result (¿error?)');

  const t0 = Date.now();
  let lastUrl = '';
  while (Date.now() - t0 < MAX_S * 1000) {
    await sleep(600);
    try {
      const u = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
      const url = u?.result?.value || '';
      if (url !== lastUrl) { console.log('  → ' + decodeURIComponent(url.split('3000/')[1] || url)); lastUrl = url; }
      const done = await send('Runtime.evaluate', { expression: 'window.__autoDone === true', returnByValue: true });
      if (done?.result?.value === true) {
        if (!autoDoneAt) { autoDoneAt = Date.now(); console.log('· toma cerrada — cola de 4s'); }
        if (Date.now() - autoDoneAt > 4000) break;
      }
    } catch {}
  }
  await send('Page.stopScreencast').catch(() => {});
  await sleep(400);

  if (frames.length < 10) throw new Error('screencast casi vacío — ¿se rompió el autopiloto?');

  // 4) concat con duraciones reales entre frames
  const list = ['ffconcat version 1.0'];
  for (let i = 0; i < frames.length; i++) {
    const dt = i + 1 < frames.length ? Math.max(0.016, frames[i + 1].ts - frames[i].ts) : 0.033;
    list.push(`file '${frames[i].file}'`, `duration ${dt.toFixed(3)}`);
  }
  list.push(`file '${frames[frames.length - 1].file}'`); // el demuxer pide repetir la última
  writeFileSync(join(FRAME_DIR, 'list.txt'), list.join('\n'));

  const out = join(OUT_DIR, `runika-demo-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.mp4`);
  const ff = spawnSync('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', join(FRAME_DIR, 'list.txt'),
    '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ], { stdio: 'inherit' });
  if (ff.status !== 0) throw new Error('ffmpeg falló');

  const secs = (frames[frames.length - 1].ts - frames[0].ts).toFixed(1);
  console.log(`\n✓ ${out}`);
  console.log(`  ${frames.length} frames · ${secs}s reales · 30fps out · 1920×1080`);
  console.log('  (sin audio — superponer una pista de assets/music/ si hace falta)');
}

run()
  .catch(e => { console.error('✗', e.message); process.exitCode = 1; })
  .finally(() => {
    try { ws?.close(); } catch {}
    try { chrome?.kill(); } catch {}
    if (serverProc) { try { spawnSync('taskkill', ['/pid', String(serverProc.pid), '/t', '/f']); } catch {} }
    setTimeout(() => process.exit(0), 500);
  });
