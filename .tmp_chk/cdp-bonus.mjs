import { spawn } from 'node:child_process';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9337', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/fbcdp-bonus`, '--window-size=1600,900',
  '--autoplay-policy=no-user-gesture-required', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9337/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(d.params.exceptionDetails).slice(0, 300));
};
const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const evalJs = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'http://localhost:3000/game.html?demo=winfinal' });
await sleep(8000);
console.log('battle active:', await evalJs('window.FinalBattle && FinalBattle.active'));
// Esperar a que pase la fase del botín (~treasure 5s + rises ~8s + attack ~15s + worlds ~15s)
for (let s = 0; s < 55; s += 5) {
  await sleep(5000);
  const ready = await evalJs('!!document.querySelector(".fb-hint")');
  const cap = await evalJs('document.querySelector(".fb-caption")?.textContent || ""');
  console.log(`t+${s + 13}s ready=${ready} cap="${cap.slice(0, 60)}" errs=${errs.length}`);
  if (errs.length) break;
}
console.log('ERRORS:', JSON.stringify(errs));
ws.close(); proc.kill(); process.exit(0);
