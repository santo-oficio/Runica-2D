// Captura en TIEMPO REAL la batalla final (CDP): node --experimental-websocket cdp-shots.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:3000/game.html?world=MAZMORRA&level=11&demo=bossrun&autowin=1&tier=6&fbdebug=1';
const SHOTS = (process.argv[2] || '20,40,60,80,100').split(',').map(Number);
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/fbcdp`, '--autoplay-policy=no-user-gesture-required', '--window-size=1600,900', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9333/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  if (d.method === 'Runtime.consoleAPICalled') console.log('console:', d.params.args.map(a => a.value).join(' ').slice(0, 170));
  if (d.method === 'Runtime.exceptionThrown') console.log('EXCEPTION:', JSON.stringify(d.params.exceptionDetails).slice(0, 400));
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
const t0 = Date.now();
for (const s of SHOTS) {
  await sleep(Math.max(0, s * 1000 - (Date.now() - t0)));
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`.tmp_chk/rt-${s}.png`, Buffer.from(r.data, 'base64'));
  console.log('shot', s);
}
ws.close(); proc.kill();
process.exit(0);
