import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9337', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/fbcdp-bb`, '--window-size=1600,900', '--hide-scrollbars', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9337/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const evalJs = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'http://localhost:3000/creditos.html' });
await sleep(7000);
// forzar foco en el boton para ver el aro
await evalJs(`(() => { const b = document.getElementById('btn-back'); b.classList.add('focused'); const r = b.getBoundingClientRect(); return JSON.stringify(r); })()`);
await sleep(400);
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('.tmp_chk/creditos-back.png', Buffer.from(shot.data, 'base64'));
console.log(await evalJs(`JSON.stringify(document.getElementById('btn-back').getBoundingClientRect())`));
ws.close(); proc.kill(); process.exit(0);
