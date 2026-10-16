// Busca cualquier texto visible que contenga "dobl" durante la batalla final.
import { spawn } from 'node:child_process';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:3000/game.html?demo=winfinal';
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9336', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/fbcdp4`, '--autoplay-policy=no-user-gesture-required', '--window-size=1600,900', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9336/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: URL });
const DUMP = `(()=>{const out=[];document.querySelectorAll('*').forEach(e=>{
  if(e.children.length===0&&e.textContent&&e.offsetParent!==null){const t=e.textContent.trim();if(t)out.push(e.tagName+'#'+(e.id||e.className)+'='+t.slice(0,90))}
});return out.join('\\n')})()`;
for (const t of [5, 12, 25, 40, 60, 80, 100, 115]) {
  await sleep(t * 1000 - (t === 5 ? 0 : [5,12,25,40,60,80,100][[5,12,25,40,60,80,100,115].indexOf(t)-1] * 1000));
  const r = await send('Runtime.evaluate', { expression: DUMP, returnByValue: true });
  const hits = (r.result.value || '').split('\n').filter(l => /dobl|fold|bend/i.test(l));
  console.log(`--- t=${t}s (${(r.result.value||'').split('\n').length} textos) hits:`, hits.length ? hits : 'ninguno');
}
ws.close(); proc.kill(); process.exit(0);
