import { spawn } from 'node:child_process';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9337', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/fbcdp-hd`, '--window-size=1600,900', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9337/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(d.params.exceptionDetails).slice(0, 200)); };
const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const evalJs = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'http://localhost:3000/demo-boss-final.html' });
await sleep(9000);
const F = 'document.getElementById("f").contentWindow.';
console.log('screen id:', await evalJs(F + 'currentScreenId'));
console.log('console btn label:', await evalJs('document.getElementById("hack").textContent'));
// Clic en el botón Consola → Tab dentro del iframe
await evalJs('document.getElementById("hack").click()');
await sleep(600);
console.log('console open:', await evalJs(F + 'document.getElementById("hack-console").classList.contains("open")'));
// Comando optimal
await evalJs(F + 'document.getElementById("hc-in").value="optimal";' + F + 'document.getElementById("hc-in").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter"}))');
await sleep(1200);
console.log('hc-out:', JSON.stringify(await evalJs(F + 'document.getElementById("hc-out").textContent.slice(-120)')));
console.log('ERRORS:', JSON.stringify(errs));
ws.close(); proc.kill(); process.exit(0);
