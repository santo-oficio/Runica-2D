// Verifica bossrun + consola de hacks rediseñada (CDP).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:3000/game.html?world=MAZMORRA&level=11&demo=bossrun&tier=6';
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9335', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/fbcdp3`, '--autoplay-policy=no-user-gesture-required', '--window-size=1600,900', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9335/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') console.log('EXCEPTION:', JSON.stringify(d.params.exceptionDetails).slice(0, 400));
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const key = async (k, code, keyCode) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: keyCode });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: keyCode });
};
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
await sleep(5000);
const st = await send('Runtime.evaluate', { expression: `JSON.stringify({entities: document.querySelectorAll('#entities .entity').length, screen: lastScreen?.id})`, returnByValue: true });
console.log('STATE:', st.result.value);
// Abrir consola y probar comandos
await key('Tab', 'Tab', 9);
await sleep(400);
await send('Runtime.evaluate', { expression: `(()=>{const i=document.getElementById('hc-in');i.value='help';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()` });
await sleep(300);
await send('Runtime.evaluate', { expression: `(()=>{const i=document.getElementById('hc-in');i.value='level 9';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()` });
await sleep(1500);
await send('Runtime.evaluate', { expression: `(()=>{const i=document.getElementById('hc-in');i.value='optimal';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()` });
await sleep(800);
await send('Runtime.evaluate', { expression: `(()=>{const i=document.getElementById('hc-in');i.value='god';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()` });
await sleep(400);
await send('Runtime.evaluate', { expression: `(()=>{const i=document.getElementById('hc-in');i.value='x93';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()` });
await sleep(400);
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('.tmp_chk/console-new.png', Buffer.from(shot.data, 'base64'));
console.log('shot saved');
ws.close(); proc.kill();
process.exit(0);
