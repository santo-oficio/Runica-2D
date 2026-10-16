import { spawn } from 'node:child_process';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9337', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/fbcdp-z`, '--window-size=1600,900', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9337/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const evalJs = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:3000/game.html' });
await sleep(5000);
console.log(await evalJs(`JSON.stringify({
  trap: getComputedStyle(document.querySelector('.entity.trap')||document.body).zIndex,
  enemy: getComputedStyle(document.querySelector('.entity[data-type="enemy"]')||document.body).zIndex,
  goal: getComputedStyle(document.querySelector('.entity.goal')||document.body).zIndex,
  selector: getComputedStyle(document.getElementById('selector')).zIndex,
  traps: document.querySelectorAll('.entity.trap').length,
  enemies: document.querySelectorAll('.entity[data-type="enemy"]').length
})`));
ws.close(); proc.kill(); process.exit(0);
