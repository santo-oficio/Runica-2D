// Diagnóstico: por qué los demos de boss final muestran tablero vacío.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.argv[2] || 'http://localhost:3000/game.html?demo=winfinal';
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9334', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/fbcdp2`, '--autoplay-policy=no-user-gesture-required', '--window-size=1600,900', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9334/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  if (d.method === 'Runtime.consoleAPICalled') console.log('console:', d.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  if (d.method === 'Runtime.exceptionThrown') console.log('EXCEPTION:', JSON.stringify(d.params.exceptionDetails).slice(0, 600));
  if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) console.log('HTTP', d.params.response.status, d.params.response.url.slice(-90));
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
await sleep(6000);
const r = await send('Runtime.evaluate', { expression: `JSON.stringify({entities: document.querySelectorAll('#entities .entity').length, tiles: document.querySelectorAll('#tiles *').length, imgOk: !!document.getElementById('bg')?.naturalWidth, worlds: (typeof worlds!=='undefined')?worlds.length:-1, screen: (typeof lastScreen!=='undefined' && lastScreen)?lastScreen.id:null, gameOver})`, returnByValue: true });
console.log('STATE:', JSON.stringify(r.result.value ?? r.result));
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('.tmp_chk/empty-diag.png', Buffer.from(shot.data, 'base64'));
ws.close(); proc.kill();
process.exit(0);
