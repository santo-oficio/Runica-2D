import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9335', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/hackcdp`, '--window-size=1600,900', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9335/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') console.log('EXC', JSON.stringify(d.params.exceptionDetails).slice(0, 400)); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`.tmp_chk/hack-${n}.png`, Buffer.from(r.data, 'base64')); };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:3000/game.html' });
await sleep(9000);

// 1) Consola cerrada: estado inicial
console.log('screen', await ev('currentScreenId'), 'tier', await ev('currentTier'));

// 2) Tab abre, se teclea "level" + Enter (vía JS en el input para no depender de IME)
const type = async (line) => {
  await ev(`(function(){const i=document.getElementById('hc-in');i.value=${JSON.stringify(line)};i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
  await sleep(600);
};
await ev('hackToggle()'); await sleep(300);
console.log('open', await ev('hackOpen'));
await type('level');
await type('optimal');
await type('turns');
await type('solutions');
await type('debug');
await type('god');
await type('speed 3');
await type('help');
console.log('--- salida consola ---');
console.log(await ev(`document.getElementById('hc-out').innerText`));
await shot('console');

// 3) Mientras está abierta, las flechas NO mueven al avatar
const before = await ev('JSON.stringify(player)');
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft' });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft' });
await sleep(600);
console.log('bloqueo movimiento:', before, '->', await ev('JSON.stringify(player)'));

// 4) hint ejecuta un movimiento
await type('hint');
await sleep(1500);
console.log('tras hint turn=', await ev('turn'), 'player=', await ev('JSON.stringify(player)'));

// 5) undo vuelve atrás
await type('undo');
await sleep(400);
console.log('tras undo turn=', await ev('turn'), 'player=', await ev('JSON.stringify(player)'));

// 6) next navega el banco
await type('next');
await sleep(800);
console.log('next ->', await ev('currentScreenId'));
await type('prev');
await sleep(800);
console.log('prev ->', await ev('currentScreenId'));

// 7) seed
await type('seed 3-1');
await sleep(800);
console.log('seed ->', await ev('currentScreenId'));

// 8) complete: reinicia y reproduce solución
await type('complete');
await sleep(600);
console.log('replaying… turn=', await ev('turn'));
await sleep(14000);
console.log('tras complete: gameOver=', await ev('gameOver'), 'won=', await ev('won'), 'turn=', await ev('turn'));
await shot('after-complete');
console.log('--- cola consola ---');
console.log(await ev(`document.getElementById('hc-out').innerText.split('\\n').slice(-6).join('\\n')`));
ws.close(); proc.kill(); process.exit(0);
