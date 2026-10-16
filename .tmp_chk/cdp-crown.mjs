// Reproduce la fase crown de la batalla final: captura pantalla + vuelca
// TODOS los nodos de texto al final para localizar el título duplicado.
// Uso: node --experimental-websocket cdp-crown.mjs [url] [shot.png] [waitS]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.argv[2] || 'http://localhost:3000/game.html?demo=winfinal';
const SHOT = process.argv[3] || '.tmp_chk/crown.png';
const WAIT_S = +(process.argv[4] || 95);
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9337', '--no-first-run',
  `--user-data-dir=${process.env.TEMP}/fbcdp-crown`, '--autoplay-policy=no-user-gesture-required',
  '--window-size=1600,900', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2500);
const tabs = await (await fetch('http://127.0.0.1:9337/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') console.log('EXCEPTION:', JSON.stringify(d.params.exceptionDetails).slice(0, 300));
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
console.log('esperando a la fase crown…');
await sleep(WAIT_S * 1000);
const dump = await evalJs(`(()=>{
  const out=[];
  document.querySelectorAll('*').forEach(e=>{
    const r=e.getBoundingClientRect();
    if(r.width===0&&r.height===0)return;
    const cs=getComputedStyle(e);
    if(cs.display==='none'||cs.visibility==='hidden')return;
    const t=(e.childElementCount===0?e.textContent:'').trim();
    if(t)out.push(e.tagName+'#'+(e.id||'')+'.'+String(e.className).slice(0,30)+' @y'+Math.round(r.top)+' op'+cs.opacity+' = '+t.slice(0,110));
  });
  const titles=document.querySelectorAll('.fb-title');
  out.push('=== .fb-title count: '+titles.length);
  titles.forEach((t,i)=>out.push('  ['+i+'] op='+getComputedStyle(t).opacity+' "'+t.textContent+'"'));
  out.push('=== .fb-caption: '+[...document.querySelectorAll('.fb-caption')].map(c=>'"'+c.textContent+'" '+(c.classList.contains('on')?'ON':'off')).join(' | '));
  out.push('=== winOverlayTitle: '+JSON.stringify(document.getElementById('overlay-title')?.textContent));
  out.push('=== music-track: '+localStorage.getItem('runika-music-track')+' | currentMusicTrack()='+(window.AssetsCache&&AssetsCache.currentMusicTrack()));
  return out.join('\\n');
})()`);
console.log(dump);
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
console.log('screenshot →', SHOT);
ws.close(); proc.kill(); process.exit(0);
