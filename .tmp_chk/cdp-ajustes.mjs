// Captura ajustes.html (CDP): node --experimental-websocket cdp-ajustes.mjs [path]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:3000/' + (process.argv[2] || 'ajustes.html');
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9334', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/ajcdp`, '--autoplay-policy=no-user-gesture-required', '--window-size=1024,686', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9334/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') console.log('EXCEPTION:', JSON.stringify(d.params.exceptionDetails).slice(0, 400));
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 686, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
await sleep(3500);
const r = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('.tmp_chk/ajustes.png', Buffer.from(r.data, 'base64'));
console.log('shot saved');
ws.close(); proc.kill();
process.exit(0);
