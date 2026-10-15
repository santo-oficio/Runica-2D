// Batalla final de Runika 2D — ocurre SOBRE EL TABLERO VIVO de game.html
// (MAZMORRA, isla 12). Nada de cambiar de página ni de escena: el héroe y
// el guardián siguen en sus casillas reales y todo continúa desde ahí.
//
//   1. El tesoro despierta: el oro sale del cofre y cae por el tablero
//   2. El guardián no se rinde: absorbe a los demás enemigos y crece
//   3. Ataque: oleadas de orbes de fuego; el héroe esquiva de casilla en casilla
//   4. Los mundos responden: el oro y los 7 orbes de los mundos van al héroe
//   5. Choque de poderes: rayo dorado contra rayo carmesí
//   6. Caída: el guardián estalla y el tablero se rompe hacia el vacío
//   7. Coronación: título con el nombre del jugador, oro total y Continuar
//
// Uso: FinalBattle.run(ctx) — ver game.html (startFinalBattle) para ctx.
(function () {
'use strict';

const CSS = `
.fb-dim{position:fixed;inset:0;z-index:12;pointer-events:none;opacity:0;transition:opacity 1.4s ease}
.fb-layer{position:fixed;inset:0;z-index:12;pointer-events:none}
.fb-canvas{position:fixed;inset:0;z-index:40;pointer-events:none}
.fb-flash{position:fixed;inset:0;background:#fff;z-index:70;pointer-events:none;opacity:0}
.fb-caption{position:fixed;left:50%;top:11%;transform:translate(-50%,-50%) scale(.85);z-index:55;
  pointer-events:none;white-space:nowrap;font-family:'ChelseaMarket',cursive;
  font-size:clamp(22px,5.2vh,60px);color:#ffd54f;opacity:0;transition:opacity .7s ease,transform .7s ease;
  text-shadow:0 0 18px rgba(255,180,60,.6),3px 3px 0 #4a2c00,-2px -2px 0 #4a2c00,2px -2px 0 #4a2c00,-2px 2px 0 #4a2c00}
.fb-caption.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.fb-caption.red{color:#ff7a5c;text-shadow:0 0 20px rgba(255,40,20,.8),3px 3px 0 #3a0600,-2px -2px 0 #3a0600,2px -2px 0 #3a0600,-2px 2px 0 #3a0600}
.fb-glow{animation:fbGlow .8s ease-in-out infinite alternate!important}
@keyframes fbGlow{from{filter:drop-shadow(0 0 6px #ffd54f) brightness(1.1)}
  to{filter:drop-shadow(0 0 28px #ffcf40) drop-shadow(0 0 54px rgba(255,180,40,.75)) brightness(1.7)}}
.fb-coin{position:fixed;z-index:30;pointer-events:none;object-fit:contain;
  filter:drop-shadow(0 0 6px rgba(255,200,0,.85))}
.fb-coin.rest{animation:fbTwinkle 1.3s ease-in-out infinite alternate}
@keyframes fbTwinkle{from{filter:drop-shadow(0 0 3px rgba(255,200,0,.6)) brightness(1)}
  to{filter:drop-shadow(0 0 14px rgba(255,225,90,1)) brightness(1.6)}}
.fb-rage{animation:fbRage .7s ease-in-out infinite alternate!important}
@keyframes fbRage{from{filter:drop-shadow(0 0 8px rgba(255,40,20,.85)) brightness(1)}
  to{filter:drop-shadow(0 0 32px rgba(255,30,10,1)) drop-shadow(0 0 64px rgba(200,0,0,.6)) brightness(1.4) saturate(1.5)}}
.fb-cracks{position:fixed;inset:0;z-index:12;pointer-events:none;overflow:visible}
.fb-cracks polyline{fill:none;stroke:#ff5a2a;stroke-linecap:round;stroke-linejoin:round;
  filter:drop-shadow(0 0 6px #ff3010) drop-shadow(0 0 14px rgba(255,60,0,.7));
  animation:fbCrack 1.1s ease-out forwards,fbCrackPulse 1.6s ease-in-out 1.1s infinite alternate}
@keyframes fbCrack{to{stroke-dashoffset:0}}
@keyframes fbCrackPulse{from{opacity:.55}to{opacity:1}}
.fb-fireball{position:fixed;z-index:32;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle at 35% 30%,#fff1c8,#ff7a2a 35%,#d0180c 62%,#3a0000 85%);
  box-shadow:0 0 20px 7px rgba(255,60,20,.85),0 0 46px 12px rgba(255,30,0,.35)}
.fb-scorch{position:fixed;z-index:12;pointer-events:none;border-radius:50%;
  background:radial-gradient(circle,rgba(25,6,0,.85),rgba(70,18,0,.45) 45%,transparent 70%)}
.fb-scorch i{position:absolute;inset:-10%;border-radius:50%;
  background:radial-gradient(circle,rgba(255,225,130,.95),rgba(255,100,20,.75) 38%,transparent 68%);
  animation:fbEmber 2.2s ease-out forwards}
@keyframes fbEmber{0%{opacity:1;transform:scale(.6)}15%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.9)}}
.fb-shock{position:fixed;z-index:31;pointer-events:none;border-radius:50%;
  border:6px solid rgba(255,90,40,.95);box-shadow:0 0 30px rgba(255,60,20,.9),inset 0 0 30px rgba(255,60,20,.6);
  animation:fbShock 1.1s ease-out forwards}
@keyframes fbShock{0%{transform:translate(-50%,-50%) scale(.1);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
@keyframes fbHop{0%,100%{transform:translateY(0)}45%{transform:translateY(-38%) scale(1.06)}}
@keyframes fbLeap{0%,100%{transform:translateY(0) rotate(0)}35%{transform:translateY(-130%) rotate(-12deg)}
  65%{transform:translateY(-110%) rotate(8deg)}}
@keyframes fbFlinch{0%,100%{transform:translate(0,0)}25%{transform:translate(-8%,2%)}50%{transform:translate(6%,-2%)}75%{transform:translate(-3%,1%)}}
.fb-power{animation:fbPower 1.1s ease-in-out infinite alternate!important}
@keyframes fbPower{from{filter:drop-shadow(0 0 4px rgba(255,225,140,.9)) drop-shadow(0 0 12px rgba(255,190,80,.5))}
  to{filter:drop-shadow(0 0 7px #fff3c4) drop-shadow(0 0 22px rgba(255,170,60,.7)) brightness(1.12)}}
.fb-halo{position:fixed;z-index:14;pointer-events:none;border-radius:50%;
  background:radial-gradient(circle,rgba(255,224,140,.6) 0%,rgba(255,180,70,.24) 42%,transparent 70%);
  animation:fbHalo 1.8s ease-in-out infinite alternate;transition:left 2.6s cubic-bezier(.4,0,.2,1),top 2.6s cubic-bezier(.4,0,.2,1),width 2.6s,height 2.6s}
@keyframes fbHalo{from{opacity:.7;transform:scale(.94)}to{opacity:1;transform:scale(1.08)}}
.fb-orb{position:fixed;z-index:31;pointer-events:none;border-radius:50%;box-shadow:0 0 22px 6px currentColor}
.fb-orb i{display:block;width:100%;height:100%;border-radius:50%}
@keyframes fbBossCharge{0%{filter:brightness(1) drop-shadow(0 0 10px rgba(255,40,20,.8))}
  40%{filter:brightness(2.4) drop-shadow(0 0 24px rgba(255,200,80,.9))}
  75%{filter:brightness(5) drop-shadow(0 0 60px #fff)}100%{filter:brightness(9) drop-shadow(0 0 90px #fff)}}
@keyframes fbBossExplode{0%{opacity:1;filter:brightness(9) drop-shadow(0 0 90px #fff)}100%{opacity:0;filter:brightness(9)}}
.fb-ring{position:fixed;z-index:64;pointer-events:none;border-radius:50%;border:6px solid rgba(255,214,100,.95);
  box-shadow:0 0 30px rgba(255,200,80,.9),inset 0 0 30px rgba(255,200,80,.5);animation:fbRing 1.9s ease-out forwards}
@keyframes fbRing{0%{transform:translate(-50%,-50%) scale(.08);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
.fb-sky{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity 2.4s ease;
  background:radial-gradient(ellipse at 50% 45%,#2c1f3e 0%,#140b1c 55%,#000 100%)}
.fb-star{position:absolute;width:2px;height:2px;border-radius:50%;background:#ffe9a3;animation:fbTw 3s ease-in-out infinite}
@keyframes fbTw{0%,100%{opacity:.12}50%{opacity:.9}}
.fb-shard{position:fixed;z-index:11;pointer-events:none;background-size:100% 100%;
  animation:fbShard var(--dur) cubic-bezier(.5,0,.9,.5) var(--delay) forwards}
@keyframes fbShard{0%{transform:translate(0,0) rotate(0);opacity:1}
  12%{transform:translate(var(--sx),var(--sy)) rotate(0);opacity:1}
  100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0}}
.fb-rays{position:fixed;left:50%;top:44%;width:130vmax;height:130vmax;transform:translate(-50%,-50%);z-index:2;
  pointer-events:none;opacity:0;border-radius:50%;transition:opacity 1.6s ease;
  background:repeating-conic-gradient(from 0deg,transparent 0deg 11deg,rgba(255,205,90,.15) 11deg 22deg)}
.fb-rays.on{opacity:.9;animation:fbRays 18s linear infinite}
@keyframes fbRays{to{transform:translate(-50%,-50%) rotate(360deg)}}
.fb-floor{position:fixed;z-index:13;pointer-events:none;opacity:0;transition:opacity 1.2s ease;
  background:radial-gradient(ellipse,rgba(255,210,110,.55),rgba(255,180,70,.15) 55%,transparent 75%)}
.fb-floor.on{opacity:1}
.fb-beam{position:fixed;z-index:3;pointer-events:none;opacity:0;transition:opacity 1.2s ease;
  background:linear-gradient(to bottom,rgba(255,232,160,.55),rgba(255,200,90,.14) 78%,transparent);
  clip-path:polygon(36% 0,64% 0,92% 100%,8% 100%)}
.fb-beam.on{opacity:1}
.fb-title{position:fixed;left:50%;top:12%;transform:translate(-50%,-50%);z-index:56;width:92%;text-align:center;
  pointer-events:none;font-family:'ChelseaMarket',cursive;font-size:clamp(28px,7.4vh,86px);color:#ffd54f;line-height:1.12;
  text-shadow:0 0 18px rgba(255,180,60,.55),3px 3px 0 #5a3410,-2px -2px 0 #5a3410,2px -2px 0 #5a3410,-2px 2px 0 #5a3410}
.fb-title span{display:inline-block;opacity:0;transform:translateY(-40px) scale(.3)}
.fb-title span.pop{animation:fbLetter .5s cubic-bezier(.2,1.8,.4,1) forwards}
@keyframes fbLetter{to{opacity:1;transform:translateY(0) scale(1)}}
.fb-sub{position:fixed;left:50%;top:79%;transform:translateX(-50%);width:74%;z-index:56;text-align:center;
  pointer-events:none;font-family:'ChelseaMarket',cursive;font-size:clamp(15px,2.9vh,32px);line-height:1.3;color:#f4e3b2;
  text-shadow:2px 2px 0 #2a1a08;opacity:0;transition:opacity .9s ease}
.fb-sub.on{opacity:1}
.fb-gold{position:fixed;left:50%;z-index:56;transform:translateX(-50%);display:flex;align-items:center;gap:.45em;
  pointer-events:none;font-family:'ChelseaMarket',cursive;color:#ffd76a;font-size:clamp(18px,3vh,34px);white-space:nowrap;
  text-shadow:0 0 14px rgba(255,190,60,.7),-2px -2px 0 #20140a,2px -2px 0 #20140a,-2px 2px 0 #20140a,2px 2px 0 #20140a;
  opacity:0;transition:opacity .8s ease}
.fb-gold.on{opacity:1}
.fb-gold img{height:1.5em}
.fb-hint{position:fixed;left:50%;top:95.5%;transform:translate(-50%,-50%);z-index:60;pointer-events:none;
  font-family:'ChelseaMarket',cursive;font-size:clamp(14px,2.6vh,28px);color:#ffe9a3;text-shadow:2px 2px 0 #2a1a08;
  opacity:0;animation:fbBlink 1.1s ease-in-out infinite}
@keyframes fbBlink{0%,100%{opacity:.25}50%{opacity:1}}
.fb-rain{position:fixed;z-index:44;pointer-events:none;object-fit:contain;animation:fbRain linear forwards}
@keyframes fbRain{0%{transform:translateY(-12vh) rotate(0)}92%{opacity:1}100%{transform:translateY(112vh) rotate(700deg);opacity:0}}
`;

const ORBS = [
  ['ESPACIO', '#9d8cff'], ['AGUA', '#4ea8ff'], ['TIERRA', '#7ac74f'],
  ['FUEGO', '#ff7a33'], ['HIELO', '#aef0ff'], ['VIENTO', '#8fffd8'],
  ['INFRAMUNDO', '#e05a6e'],
];
const SND = {
  hit: '/assets/sounds/comun/choque.wav',
  bell: '/assets/sounds/comun/orbe.wav',
  coin: '/assets/sounds/comun/moneda.wav',
  rumble: '/assets/sounds/comun/derrumbe.mp3',
  trap: '/assets/sounds/comun/trampa.wav',
};

const wait = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
// Progreso 0..1 desde t0 — siempre con performance.now(): el timestamp de
// rAF puede ir por detrás y dar progresos negativos (el easing se dispara)
const prog = (t0, d) => Math.max(0, Math.min(1, (performance.now() - t0) / d));

let S = null; // estado de la batalla en curso

function el(tag, cls, parent = document.body) {
  const e = document.createElement(tag);
  // Los textos del juego ya van traducidos desde i18n — la traducción
  // automática del navegador solo podría mezclar idiomas encima
  e.classList.add('notranslate');
  e.setAttribute('translate', 'no');
  if (cls) e.className += ' ' + cls;
  parent.appendChild(e);
  S.trash.push(e);
  return e;
}
function center(node) {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}
function sfx(url, vol = 0.6, rate = 1) {
  const a = window.AssetsCache && AssetsCache.playSound(url, vol);
  if (a && rate !== 1) a.playbackRate = rate;
  return a;
}
function fadeOut(a, sec) {
  if (!a) return;
  const v0 = a.volume || 0.5;
  const iv = setInterval(() => {
    a.volume = Math.max(0, a.volume - v0 / 20);
    if (a.volume <= 0 || a.paused) { clearInterval(iv); a.pause(); }
  }, sec * 50);
}
function flash(alpha, ms) {
  const f = S.flash;
  f.style.transition = 'none'; f.style.opacity = alpha;
  requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms ease`; f.style.opacity = 0; });
}
async function caption(text, ms, red) {
  const c = S.caption;
  c.textContent = text;
  c.classList.toggle('red', !!red);
  c.classList.add('on');
  await wait(ms);
  c.classList.remove('on');
}
function heroCenter() { return center(S.ctx.hero); }
function bossCenter() { return center(S.ctx.boss); }
function cellCenter(c, r) {
  const p = S.ctx.cell(c, r);
  return { x: p.left + p.w / 2, y: p.top + p.h / 2, w: p.w, h: p.h };
}

// ---------- Partículas + dibujo de rayos (canvas) ----------
function startCanvas() {
  const cv = el('canvas', 'fb-canvas');
  const g = cv.getContext('2d');
  const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
  resize(); addEventListener('resize', resize);
  const loop = (now) => {
    if (!S) return;
    g.clearRect(0, 0, cv.width, cv.height);
    for (const d of S.drawers) d(g, now);
    S.parts = S.parts.filter(p => p.life > 0);
    for (const p of S.parts) {
      p.life--; p.x += p.vx; p.y += p.vy; p.vy += p.g;
      if (p.drag) { p.vx *= .985; p.vy *= .985; }
      const a = Math.max(0, p.life / p.max);
      g.globalAlpha = a; g.fillStyle = p.color;
      g.beginPath(); g.arc(p.x, p.y, p.size, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    S.raf = requestAnimationFrame(loop);
  };
  S.raf = requestAnimationFrame(loop);
}
function burst(x, y, n, colors, speed, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = speed * (0.35 + Math.random());
    const life = (o.life ?? 50) * (0.6 + Math.random() * 0.8);
    S.parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), g: o.g ?? 0.12,
      life, max: life, size: o.size ?? (2 + Math.random() * 3),
      color: colors[i % colors.length], drag: o.drag !== false,
    });
  }
}

// ---------- Movimiento del héroe entre casillas ----------
function moveHero(c, r, ms = 300, anim = 'fbHop') {
  const p = S.ctx.cell(c, r);
  const h = S.ctx.hero;
  h.style.transition = `left ${ms}ms ease-out, top ${ms}ms ease-out`;
  h.style.left = p.left + 'px';
  h.style.top = p.top + 'px';
  S.ctx.heroImg.style.animation = 'none';
  void S.ctx.heroImg.offsetWidth;
  S.ctx.heroImg.style.animation = `${anim} ${ms + 60}ms ease-out`;
  S.hc = c; S.hr = r;
  if (S.ctx.step) S.ctx.step();
}
function dodgeCell() {
  const { cols, rows } = S.ctx;
  const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dc, dr]) => [S.hc + dc, S.hr + dr])
    .filter(([c, r]) => c >= 0 && r >= 0 && c < cols && r < rows && !(c === S.bc && r === S.br));
  if (!opts.length) return null;
  // Prefiere alejarse del guardián, con algo de azar para que no sea robótico
  opts.sort((a, b) => (Math.hypot(b[0] - S.bc, b[1] - S.br) - Math.hypot(a[0] - S.bc, a[1] - S.br)) + rnd(-0.8, 0.8));
  return opts[0];
}

// Orbe de fuego del guardián: arco hacia un punto; resuelve al impactar
function fireball(from, to, dur, size) {
  return new Promise(res => {
    const f = el('div', 'fb-fireball');
    f.style.width = f.style.height = size + 'px';
    const mx = (from.x + to.x) / 2, my = Math.min(from.y, to.y) - Math.hypot(to.x - from.x, to.y - from.y) * 0.35 - 30;
    const t0 = performance.now();
    const step = () => {
      const k = prog(t0, dur), u = 1 - k;
      const x = u * u * from.x + 2 * u * k * mx + k * k * to.x;
      const y = u * u * from.y + 2 * u * k * my + k * k * to.y;
      f.style.left = (x - size / 2) + 'px'; f.style.top = (y - size / 2) + 'px';
      if (Math.random() < 0.7) S.parts.push({ x, y, vx: rnd(-.6, .6), vy: rnd(-.6, .6), g: -0.02, life: 22, max: 22, size: rnd(2, 4.5), color: Math.random() < .5 ? '#ff7a2a' : '#ffd08a', drag: true });
      if (k < 1) requestAnimationFrame(step); else { f.remove(); res(); }
    };
    requestAnimationFrame(step);
    setTimeout(() => { if (f.isConnected) { f.remove(); res(); } }, dur + 600);
  });
}
function impact(c, r, big) {
  const p = cellCenter(c, r);
  const s = el('div', 'fb-scorch', S.layer);
  s.appendChild(document.createElement('i'));
  const sz = p.w * (big ? 1.5 : 1.15);
  s.style.left = (p.x - sz / 2) + 'px'; s.style.top = (p.y - sz / 2) + 'px';
  s.style.width = s.style.height = sz + 'px';
  burst(p.x, p.y, big ? 60 : 38, ['#fff1c8', '#ff9a3c', '#e8361b', '#5a1a08'], big ? 8 : 6, { size: 4, g: 0.14, life: 46 });
  sfx(SND.hit, big ? 0.75 : 0.5, rnd(0.8, 1));
  S.ctx.shake();
}

// ---------- Fases ----------
async function phaseTreasure() {
  const { goal } = S.ctx;
  const hc = heroCenter();
  S.dim.style.background = `radial-gradient(circle at ${hc.x}px ${hc.y}px, rgba(0,0,0,.05) 0, rgba(0,0,0,.25) 22vmin, rgba(0,0,0,.72) 70vmin)`;
  S.dim.style.opacity = '1';
  if (goal) goal.classList.add('fb-glow');
  flash(0.55, 700);
  caption(S.ctx.tt('fin.treasureWakes'), 2600);
  // El oro sale disparado del cofre y cae repartido por el tablero
  const g = goal ? center(goal) : hc;
  burst(g.x, g.y, 70, ['#fff3c4', '#ffd54f', '#ffb020'], 7, { size: 3, g: 0.08, up: 2, life: 60 });
  S.ctx.flyGold(g.x, g.y, S.ctx.goldBefore, S.ctx.goldEarned, () => {});
  const tl = S.ctx.cell(0, 0), br = S.ctx.cell(S.ctx.cols - 1, S.ctx.rows - 1);
  for (let i = 0; i < 28; i++) {
    setTimeout(() => {
      const coin = el('img', 'fb-coin', S.layer);
      coin.src = '/assets/comunes/monedas.webp';
      const sz = tl.w * rnd(0.22, 0.34);
      coin.style.width = coin.style.height = sz + 'px';
      const tx = rnd(tl.left + sz, br.left + br.w - sz), ty = rnd(tl.top + sz, br.top + br.h - sz);
      const mx = (g.x + tx) / 2, my = Math.min(g.y, ty) - rnd(120, 260);
      const t0 = performance.now(), dur = rnd(700, 1100);
      const step = () => {
        const k = prog(t0, dur), u = 1 - k;
        coin.style.left = (u * u * g.x + 2 * u * k * mx + k * k * tx - sz / 2) + 'px';
        coin.style.top = (u * u * g.y + 2 * u * k * my + k * k * ty - sz / 2) + 'px';
        if (k < 1) { requestAnimationFrame(step); return; }
        coin.classList.add('rest');
        if (i % 3 === 0) sfx(SND.coin, 0.25, rnd(0.9, 1.2));
      };
      requestAnimationFrame(step);
      S.coins.push(coin);
    }, i * 45);
  }
  await wait(3400);
}

async function phaseBossRises() {
  const { boss, others, tt } = S.ctx;
  caption(tt('fin.bossRises'), 3000, true);
  if (S.ctx.goal) S.ctx.goal.classList.remove('fb-glow');
  sfx(SND.hit, 1, 0.5);
  S.ctx.shake(); setTimeout(S.ctx.shake, 260); setTimeout(S.ctx.shake, 520);
  boss.classList.add('fb-rage');
  boss.style.transition = 'transform .7s cubic-bezier(.3,1.6,.5,1), left .7s ease, top .7s ease';
  let scale = 1.3;
  boss.style.transformOrigin = '50% 70%';
  boss.style.transform = `scale(${scale})`;
  // Grietas rojas que nacen bajo el guardián y recorren el tablero
  const b = bossCenter();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'fb-cracks');
  svg.setAttribute('width', innerWidth); svg.setAttribute('height', innerHeight);
  S.layer.appendChild(svg);
  const cw = S.ctx.cell(0, 0).w;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rnd(-0.3, 0.3);
    let x = b.x, y = b.y + b.h * 0.25;
    const pts = [[x, y]];
    const len = cw * rnd(2.2, 4.2);
    const segs = 6;
    for (let s = 1; s <= segs; s++) {
      const ang = a + rnd(-0.5, 0.5);
      x += Math.cos(ang) * len / segs; y += Math.sin(ang) * len / segs * 0.75;
      pts.push([x, y]);
    }
    const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    pl.setAttribute('points', pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' '));
    pl.setAttribute('stroke-width', String(Math.max(2, cw * 0.05)));
    const L = len * 1.4;
    pl.style.strokeDasharray = L; pl.style.strokeDashoffset = L;
    pl.style.animationDelay = (i * 0.07) + 's, ' + (1.1 + i * 0.07) + 's';
    svg.appendChild(pl);
  }
  burst(b.x, b.y, 50, ['#ff5a2a', '#ffb199', '#8a0a00'], 6, { size: 4, g: 0.05, life: 50 });
  await wait(900);
  // Absorbe a los demás enemigos: cada uno vuela hacia él y lo agranda
  for (const o of others) {
    o.style.transition = 'left .75s ease-in, top .75s ease-in, transform .75s ease-in, opacity .75s ease-in';
    const oc = center(o);
    o.style.left = (parseFloat(o.style.left) + (b.x - oc.x)) + 'px';
    o.style.top = (parseFloat(o.style.top) + (b.y - oc.y)) + 'px';
    o.style.transform = 'scale(.15) rotate(220deg)';
    o.style.opacity = '0';
    await wait(760);
    scale += 0.14;
    boss.style.transform = `scale(${scale})`;
    burst(b.x, b.y, 40, ['#ff3a1a', '#ffb199', '#400000'], 5, { size: 4, g: 0.02 });
    sfx(SND.trap, 0.5, 0.7);
    S.ctx.shake();
  }
  S.bossScale = scale;
  await wait(others.length ? 900 : 1600);
}

async function bossCharge(ms) {
  const { boss } = S.ctx;
  boss.style.transition = `transform ${ms}ms ease-in`;
  boss.style.transform = `scale(${S.bossScale * 1.12})`;
  const b = bossCenter();
  // Partículas que convergen hacia el guardián
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, d = b.w * rnd(1, 1.8);
    const life = ms / 16;
    S.parts.push({ x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, vx: -Math.cos(a) * d / life, vy: -Math.sin(a) * d / life, g: 0, life, max: life, size: rnd(2, 4), color: Math.random() < .5 ? '#ff4020' : '#ffc0a0', drag: false });
  }
  await wait(ms);
  boss.style.transition = 'transform .25s cubic-bezier(.3,1.8,.5,1)';
  boss.style.transform = `scale(${S.bossScale})`;
}

async function phaseAttack() {
  const cw = S.ctx.cell(0, 0).w;
  for (let wave = 0; wave < 3; wave++) {
    await bossCharge(650 - wave * 80);
    const shots = 2 + wave;
    for (let s = 0; s < shots; s++) {
      const tc = S.hc, tr = S.hr;
      const to = cellCenter(tc, tr);
      const dur = 900 - wave * 120;
      sfx(SND.trap, 0.35, 1.3);
      const p = fireball(bossCenter(), to, dur, cw * 0.42);
      // El héroe esquiva justo antes del impacto
      setTimeout(() => { const d = dodgeCell(); if (d) moveHero(d[0], d[1], 260); }, dur * 0.62);
      if (s < shots - 1) await wait(dur * 0.75);
      p.then(() => impact(tc, tr, false));
    }
    await wait(1300);
  }
  // Remate del guardián: golpe al suelo y onda de choque que barre el
  // tablero — el héroe la salta
  await bossCharge(900);
  const b = bossCenter();
  sfx(SND.hit, 1, 0.55);
  flash(0.5, 400);
  S.ctx.shake(); setTimeout(S.ctx.shake, 200);
  const tl = S.ctx.cell(0, 0), br = S.ctx.cell(S.ctx.cols - 1, S.ctx.rows - 1);
  const reach = Math.hypot(br.left + br.w - tl.left, br.top + br.h - tl.top) * 2.2;
  for (let i = 0; i < 3; i++) {
    const ring = el('div', 'fb-shock');
    ring.style.left = b.x + 'px'; ring.style.top = b.y + 'px';
    ring.style.width = ring.style.height = reach + 'px';
    ring.style.animationDelay = (i * 0.16) + 's';
    setTimeout(() => ring.remove(), 1500 + i * 160);
  }
  const heroD = Math.hypot(heroCenter().x - b.x, heroCenter().y - b.y);
  setTimeout(() => {
    S.ctx.heroImg.style.animation = 'none'; void S.ctx.heroImg.offsetWidth;
    S.ctx.heroImg.style.animation = 'fbLeap .9s ease-out';
    if (S.ctx.step) S.ctx.step();
  }, Math.max(0, (heroD / (reach / 2)) * 1100 - 280));
  for (let c = 0; c < S.ctx.cols; c++) for (let r = 0; r < S.ctx.rows; r++) {
    if (c === S.hc && r === S.hr) continue;
    const p = cellCenter(c, r);
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (Math.random() < 0.45) setTimeout(() => burst(p.x, p.y, 10, ['#ff9a3c', '#e8361b', '#5a1a08'], 3, { size: 3, g: 0.1, life: 34 }), (d / (reach / 2)) * 1100);
  }
  await wait(2200);
}

function startOrbit(orbs) {
  let a0 = 0, last = performance.now();
  const loop = () => {
    if (!S || S.orbitStop) return;
    const t = performance.now();
    a0 += (t - last) * 0.0016; last = t;
    const h = heroCenter();
    const R = S.ctx.cell(0, 0).w * 1.15;
    orbs.forEach((o, i) => {
      if (!o.inOrbit) return;
      const a = a0 + (i / orbs.length) * Math.PI * 2;
      const x = h.x + Math.cos(a) * R, y = h.y + Math.sin(a) * R * 0.55 - h.h * 0.1;
      o.el.style.left = (x - o.sz / 2) + 'px'; o.el.style.top = (y - o.sz / 2) + 'px';
      o.el.style.zIndex = Math.sin(a) > 0 ? 31 : 14;
    });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function phaseWorlds() {
  const { tt, heroImg } = S.ctx;
  caption(tt('fin.worldsPower'), 3600);
  heroImg.classList.add('fb-power');
  const h = heroCenter();
  const halo = el('div', 'fb-halo');
  S.halo = halo;
  const placeHalo = (sz) => {
    const c = heroCenter();
    halo.style.width = halo.style.height = sz + 'px';
    halo.style.left = (c.x - sz / 2) + 'px'; halo.style.top = (c.y - sz / 2) + 'px';
  };
  placeHalo(h.w * 2.2);
  // El oro del tablero vuela hacia el héroe
  S.coins.forEach((coin, i) => {
    setTimeout(() => {
      coin.classList.remove('rest');
      coin.style.transition = 'left .55s ease-in, top .55s ease-in, opacity .55s ease-in, transform .55s ease-in';
      const c = heroCenter();
      coin.style.left = (c.x - coin.offsetWidth / 2) + 'px';
      coin.style.top = (c.y - coin.offsetHeight / 2) + 'px';
      coin.style.transform = 'scale(.3)'; coin.style.opacity = '0';
      if (i % 3 === 0) sfx(SND.coin, 0.22, rnd(1, 1.3));
      setTimeout(() => burst(c.x, c.y, 6, ['#ffd54f', '#fff3c4'], 2, { size: 2.5, g: 0 }), 550);
    }, i * 55);
  });
  await wait(S.coins.length * 55 + 700);
  placeHalo(h.w * 3.2);
  // Los 7 mundos le prestan su fuerza: orbes que llegan desde los bordes
  const tl = S.ctx.cell(0, 0), br = S.ctx.cell(S.ctx.cols - 1, S.ctx.rows - 1);
  const orbs = ORBS.map(([, col]) => {
    const o = el('div', 'fb-orb');
    const sz = tl.w * 0.36;
    o.style.width = o.style.height = sz + 'px';
    o.style.color = col;
    const core = document.createElement('i');
    core.style.background = `radial-gradient(circle at 35% 30%, #fff, ${col} 55%)`;
    o.appendChild(core);
    o.style.opacity = '0';
    return { el: o, sz, col, inOrbit: false };
  });
  S.orbs = orbs;
  startOrbit(orbs);
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i];
    const side = i % 4;
    const sx = side === 0 ? tl.left - 40 : side === 1 ? br.left + br.w + 40 : rnd(tl.left, br.left + br.w);
    const sy = side === 2 ? tl.top - 40 : side === 3 ? br.top + br.h + 40 : rnd(tl.top, br.top + br.h);
    o.el.style.left = (sx - o.sz / 2) + 'px'; o.el.style.top = (sy - o.sz / 2) + 'px';
    o.el.style.opacity = '1';
    const t0 = performance.now(), dur = 800;
    await new Promise(res => {
      const step = () => {
        const k = ease(prog(t0, dur));
        const c = heroCenter();
        o.el.style.left = (lerp(sx, c.x, k) - o.sz / 2) + 'px';
        o.el.style.top = (lerp(sy, c.y - c.h * 0.1, k) - o.sz / 2) + 'px';
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    o.inOrbit = true;
    const c = heroCenter();
    burst(c.x, c.y, 22, ['#fff3c4', o.col], 4, { size: 3, g: 0.02 });
    sfx(SND.bell, 0.5, 1 + i * 0.17);
    await wait(380);
  }
  // Energía que sube alrededor del héroe hasta el choque
  // Energía que sube por los costados del héroe (sin taparlo)
  S.energy = setInterval(() => {
    const c = heroCenter();
    const side = Math.random() < 0.5 ? -1 : 1;
    burst(c.x + side * c.w * rnd(0.4, 0.62), c.y + c.h * rnd(0.1, 0.45), 2, ['#fff3c4', '#ffd54f'], 0.6, { up: 2.2, g: -0.03, size: 2, life: 36 });
  }, 110);
  await wait(1200);
}

async function phaseClash() {
  const st = { t: 0.5, grow: 0, phase: 'grow' };
  const rumble = sfx(SND.rumble, 0.45, 0.8);
  const draw = (g, now) => {
    const h = heroCenter(), b = bossCenter();
    const cx = lerp(h.x, b.x, st.t), cy = lerp(h.y, b.y, st.t);
    const ext = st.grow;
    const hx = lerp(h.x, cx, ext), hy = lerp(h.y, cy, ext);
    const bx = lerp(b.x, cx, ext), by = lerp(b.y, cy, ext);
    const wob = Math.sin(now / 45) * 3;
    const beam = (x1, y1, x2, y2, outer, inner, w) => {
      g.save();
      g.lineCap = 'round';
      g.shadowColor = outer; g.shadowBlur = 30;
      g.strokeStyle = outer; g.lineWidth = w + wob;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.shadowBlur = 0; g.strokeStyle = inner; g.lineWidth = Math.max(2, w * 0.35);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.restore();
    };
    const w = S.ctx.cell(0, 0).w * 0.22;
    beam(h.x, h.y, hx, hy, 'rgba(255,200,70,.9)', '#fffbe6', w);
    beam(b.x, b.y, bx, by, 'rgba(230,30,20,.9)', '#ffd2c4', w);
    if (ext >= 1) {
      g.save();
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, w * 3);
      rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(.4, 'rgba(255,190,90,.6)'); rg.addColorStop(1, 'rgba(255,80,20,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, w * 3 * (1 + Math.sin(now / 70) * .15), 0, 7); g.fill();
      g.restore();
      if (Math.random() < 0.8) burst(cx, cy, 3, ['#fff', '#ffd54f', '#ff5a2a'], 5, { size: 2.5, g: 0.06, life: 30 });
    }
  };
  S.drawers.push(draw);
  sfx(SND.hit, 0.9, 0.7); flash(0.6, 400);
  const tween = (key, to, ms) => new Promise(res => {
    const from = st[key], t0 = performance.now();
    const step = () => {
      const k = prog(t0, ms);
      st[key] = lerp(from, to, ease(k));
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  await tween('grow', 1, 550);
  const shakeIv = setInterval(() => { S.ctx.shake(); sfx(SND.hit, 0.3, rnd(0.6, 0.9)); }, 520);
  // Forcejeo: el guardián empuja y el choque se acerca peligrosamente
  await tween('t', 0.56, 900);
  await tween('t', 0.44, 900);
  await tween('t', 0.3, 2200);
  await wait(500);
  // Los orbes se funden en el héroe: el rayo dorado se desata
  S.orbitStop = true;
  for (let i = 0; i < S.orbs.length; i++) {
    const o = S.orbs[i];
    const c = heroCenter();
    o.el.style.transition = 'left .35s ease-in, top .35s ease-in, opacity .35s ease-in';
    o.el.style.left = (c.x - o.sz / 2) + 'px'; o.el.style.top = (c.y - o.sz / 2) + 'px';
    o.el.style.opacity = '0';
    setTimeout(() => burst(c.x, c.y, 18, ['#fff', o.col], 4, { size: 3, g: 0 }), 350);
    sfx(SND.bell, 0.45, 1 + i * 0.17);
    await wait(160);
  }
  await wait(250);
  flash(0.85, 600);
  sfx(SND.hit, 1, 0.9);
  if (S.halo) { const c = heroCenter(); const sz = c.w * 4.2; S.halo.style.width = S.halo.style.height = sz + 'px'; S.halo.style.left = (c.x - sz / 2) + 'px'; S.halo.style.top = (c.y - sz / 2) + 'px'; }
  await tween('t', 0.98, 2300);
  clearInterval(shakeIv);
  fadeOut(rumble, 1.2);
  S.drawers = S.drawers.filter(d => d !== draw);
}

function shatterBoard(origin) {
  const ir = S.ctx.imgRect();
  const img = S.ctx.image;
  if (!ir.width || !img) return;
  const src = img.currentSrc || img.src;
  const C = 7, R = 5;
  const pts = [];
  for (let j = 0; j <= R; j++) {
    pts.push([]);
    for (let i = 0; i <= C; i++) {
      const edge = i === 0 || j === 0 || i === C || j === R;
      pts[j].push([
        (i / C) * ir.width + (edge ? 0 : rnd(-0.3, 0.3) * ir.width / C),
        (j / R) * ir.height + (edge ? 0 : rnd(-0.3, 0.3) * ir.height / R),
      ]);
    }
  }
  const tri = [];
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
    const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i + 1], d = pts[j + 1][i];
    tri.push([a, b, c], [a, c, d]);
  }
  const ox = origin.x - ir.left, oy = origin.y - ir.top;
  for (const t of tri) {
    const sh = el('div', 'fb-shard');
    sh.style.left = ir.left + 'px'; sh.style.top = ir.top + 'px';
    sh.style.width = ir.width + 'px'; sh.style.height = ir.height + 'px';
    sh.style.backgroundImage = `url("${src}")`;
    sh.style.clipPath = 'polygon(' + t.map(p => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(',') + ')';
    const gx = (t[0][0] + t[1][0] + t[2][0]) / 3, gy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    const dx = gx - ox, dy = gy - oy, dl = Math.hypot(dx, dy) || 1;
    sh.style.setProperty('--sx', (dx / dl * 10).toFixed(1) + 'px');
    sh.style.setProperty('--sy', (dy / dl * 10).toFixed(1) + 'px');
    sh.style.setProperty('--dx', (dx / dl * rnd(60, 180)).toFixed(1) + 'px');
    sh.style.setProperty('--dy', (dy / dl * 60 + rnd(innerHeight * .6, innerHeight * 1.1)).toFixed(1) + 'px');
    sh.style.setProperty('--rot', rnd(-200, 200).toFixed(0) + 'deg');
    sh.style.setProperty('--dur', rnd(1.8, 2.8).toFixed(2) + 's');
    sh.style.setProperty('--delay', (dl / Math.hypot(ir.width, ir.height) * 1.1 + rnd(0, .25)).toFixed(2) + 's');
  }
  img.style.opacity = '0';
}

async function phaseFall() {
  const { boss } = S.ctx;
  const b = bossCenter();
  sfx(SND.hit, 0.8, 0.6);
  boss.classList.remove('fb-rage');
  boss.style.animation = 'fbBossCharge 1.3s ease-in forwards';
  for (let i = 0; i < 4; i++) { setTimeout(() => { flash(0.35, 250); S.ctx.shake(); burst(b.x, b.y, 24, ['#fff', '#ffd54f'], 5, { size: 3, g: 0 }); }, i * 300); }
  await wait(1300);
  // La explosión
  flash(1, 1100);
  sfx(SND.hit, 1, 0.5); setTimeout(() => sfx(SND.hit, 0.9, 0.75), 140);
  S.ctx.shake(); setTimeout(S.ctx.shake, 220); setTimeout(S.ctx.shake, 440);
  boss.style.animation = 'fbBossExplode .7s ease-out forwards';
  boss.style.transition = 'transform .7s ease-out, opacity .7s ease-out';
  boss.style.transform = `scale(${S.bossScale * 1.9})`;
  boss.style.opacity = '0';
  setTimeout(() => { boss.style.visibility = 'hidden'; }, 750);
  burst(b.x, b.y, 180, ['#ffd54f', '#ff9a3c', '#fff3c4', '#e86a4a', '#ffffff'], 12, { size: 5, g: 0.08, life: 80 });
  const big = Math.max(innerWidth, innerHeight) * 1.4;
  for (let i = 0; i < 5; i++) {
    const ring = el('div', 'fb-ring');
    ring.style.left = b.x + 'px'; ring.style.top = b.y + 'px';
    ring.style.width = ring.style.height = big * (0.5 + i * 0.15) + 'px';
    ring.style.animationDelay = (i * 0.17) + 's';
  }
  clearInterval(S.energy);
  await wait(800);
  // El tablero se rompe y cae al vacío; el héroe queda flotando en su sitio
  S.sky.style.opacity = '1';
  const rumble = sfx(SND.rumble, 0.6, 1);
  setTimeout(() => fadeOut(rumble, 2.5), 3500);
  shatterBoard(b);
  S.dim.style.opacity = '0';
  S.layer.style.transition = 'opacity 1.2s ease'; S.layer.style.opacity = '0';
  S.ctx.hideHud();
  document.querySelectorAll('#entities .entity').forEach(e => {
    if (e === boss) return;
    e.style.transition = `transform ${rnd(1.4, 2.2).toFixed(2)}s cubic-bezier(.5,0,.9,.5) ${rnd(0.1, 0.9).toFixed(2)}s, opacity 1.6s ease ${rnd(0.4, 1).toFixed(2)}s`;
    e.style.transform = `translateY(${rnd(innerHeight * .6, innerHeight)}px) rotate(${rnd(-180, 180).toFixed(0)}deg)`;
    e.style.opacity = '0';
  });
  await wait(3200);
}

async function phaseCrown() {
  const { hero, heroImg, tt, name } = S.ctx;
  // El héroe sube al centro del cielo, más grande, bajo el foco
  const h = heroCenter();
  const tx = innerWidth / 2, ty = innerHeight * 0.55;
  const k = Math.min(3.2, (innerHeight * 0.32) / Math.max(1, h.h));
  hero.style.transition = 'transform 2.6s cubic-bezier(.4,0,.2,1)';
  hero.style.transform = `translate(${tx - h.x}px, ${ty - h.y}px) scale(${k})`;
  hero.style.zIndex = '20';
  if (S.halo) {
    const sz = h.w * k * 2.4;
    S.halo.style.width = S.halo.style.height = sz + 'px';
    S.halo.style.left = (tx - sz / 2) + 'px'; S.halo.style.top = (ty - sz / 2) + 'px';
  }
  const rays = el('div', 'fb-rays');
  const beam = el('div', 'fb-beam');
  const bw = innerHeight * 0.44;
  beam.style.left = (tx - bw / 2) + 'px'; beam.style.top = '0px';
  beam.style.width = bw + 'px'; beam.style.height = (ty + innerHeight * 0.16) + 'px';
  const floor = el('div', 'fb-floor');
  floor.style.width = innerHeight * 0.62 + 'px'; floor.style.height = innerHeight * 0.12 + 'px';
  floor.style.left = (tx - innerHeight * 0.31) + 'px'; floor.style.top = (ty + innerHeight * 0.16 - innerHeight * 0.06) + 'px';
  requestAnimationFrame(() => { beam.classList.add('on'); floor.classList.add('on'); });
  sfx(SND.bell, 0.45, 0.6);
  await wait(2700);
  heroImg.style.animation = 'none';
  hero.style.transition = 'transform 3.4s ease-in-out';
  let up = false;
  S.sway = setInterval(() => { up = !up; hero.style.transform = `translate(${tx - h.x}px, ${ty - h.y + (up ? -10 : 10)}px) scale(${k})`; }, 3400);

  // Los mundos vuelven a brillar: los orbes salen del héroe y lo coronan
  const arcY = ty - innerHeight * 0.31, arcRx = innerHeight * 0.36;
  for (let i = 0; i < ORBS.length; i++) {
    const col = ORBS[i][1];
    const a = (-65 + (130 * i / (ORBS.length - 1))) * Math.PI / 180;
    const ox = tx + Math.sin(a) * arcRx, oy = arcY + (1 - Math.cos(a)) * innerHeight * 0.1;
    const o = el('div', 'fb-orb');
    const sz = innerHeight * 0.055;
    o.style.width = o.style.height = sz + 'px'; o.style.color = col; o.style.zIndex = '25';
    const core = document.createElement('i');
    core.style.background = `radial-gradient(circle at 35% 30%, #fff, ${col} 55%)`;
    o.appendChild(core);
    o.style.left = (tx - sz / 2) + 'px'; o.style.top = (ty - sz / 2) + 'px';
    o.style.transition = 'left .8s cubic-bezier(.3,.7,.35,1), top .8s cubic-bezier(.3,.7,.35,1)';
    requestAnimationFrame(() => requestAnimationFrame(() => { o.style.left = (ox - sz / 2) + 'px'; o.style.top = (oy - sz / 2) + 'px'; }));
    setTimeout(() => {
      burst(ox, oy, 26, ['#fff3c4', col], 4.5, { size: 3, g: 0.04 });
      sfx(SND.bell, 0.5, 1 + i * 0.17);
      o.animate([{ marginTop: '-7px' }, { marginTop: '7px' }], { duration: 2600, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    }, 800);
    await wait(700);
  }
  await wait(1200);

  // Gran final: rayos, título con el nombre del jugador letra a letra
  flash(0.9, 1000);
  rays.classList.add('on');
  const title = el('div', 'fb-title');
  const text = name ? tt('fin.completedNamed', name) : tt('fin.completed');
  // Letras agrupadas por palabra: el título solo parte entre palabras
  const letters = [];
  text.split(' ').forEach((word, wi) => {
    if (wi) title.appendChild(document.createTextNode(' '));
    const wd = document.createElement('b');
    wd.style.cssText = 'white-space:nowrap;font-weight:inherit';
    for (const ch of word) {
      const sp = document.createElement('span');
      sp.textContent = ch;
      wd.appendChild(sp); letters.push(sp);
    }
    title.appendChild(wd);
  });
  for (const l of letters) { l.classList.add('pop'); await wait(85); }

  // Lluvia de monedas + fuegos artificiales
  coinRain();
  const fw = setInterval(() => {
    const x = innerWidth * rnd(0.12, 0.88), y = innerHeight * rnd(0.1, 0.5);
    burst(x, y, 50, ['#ffd54f', '#ff9a3c', '#fff3c4', '#e86a4a', '#7ec8e3', '#b58cff'], 7, { g: 0.05, size: 3, life: 72 });
    sfx(SND.hit, 0.08, rnd(1.2, 1.6));
  }, 750);
  setTimeout(() => clearInterval(fw), 12000);
  await wait(1400);

  const sub = el('div', 'fb-sub');
  sub.textContent = tt('fin.replay');
  requestAnimationFrame(() => sub.classList.add('on'));
  await wait(1600);

  // Total de oro conseguido, contado hacia arriba bajo el mensaje
  const total = S.ctx.goldTotal;
  if (typeof total === 'number') {
    const g = el('div', 'fb-gold');
    const ic = document.createElement('img'); ic.src = '/assets/comunes/monedas.webp';
    const sp = document.createElement('span');
    g.append(ic, sp);
    g.style.top = Math.min(innerHeight * 0.9, sub.getBoundingClientRect().bottom + innerHeight * 0.02) + 'px';
    sp.textContent = tt('fin.goldTotal', 0);
    requestAnimationFrame(() => g.classList.add('on'));
    const t0 = performance.now(), dur = 2400;
    let lastClink = 0;
    await new Promise(res => {
      const step = () => {
        const kk = prog(t0, dur), t = performance.now();
        sp.textContent = tt('fin.goldTotal', Math.round(total * ease(kk)));
        if (t - lastClink > 140 && kk < 1) { lastClink = t; sfx(SND.coin, 0.18, 0.9 + kk * 0.5); }
        if (kk < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    burst(innerWidth / 2, g.getBoundingClientRect().top + 10, 40, ['#ffd54f', '#fff3c4'], 5, { size: 3, g: 0.06 });
  }
  await wait(2600);
  const hint = el('div', 'fb-hint');
  hint.textContent = tt('instructions.continue');
  S.ready = true;
}

function coinRain() {
  for (let i = 0; i < 44; i++) {
    setTimeout(() => {
      if (!S) return;
      const c = el('img', 'fb-rain');
      c.src = '/assets/comunes/monedas.webp';
      const sz = rnd(26, 70);
      c.style.width = sz + 'px';
      c.style.left = rnd(0, 96) + 'vw'; c.style.top = '-10vh';
      c.style.animationDuration = rnd(2.4, 4.8) + 's';
      if (i % 2 === 0) sfx(SND.coin, 0.2, rnd(0.9, 1.2));
      setTimeout(() => c.remove(), 5200);
    }, i * 170);
  }
}

// ---------- API ----------
async function run(ctx) {
  if (S) return;
  if (!document.getElementById('fb-css')) {
    const st = document.createElement('style'); st.id = 'fb-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  S = { ctx, trash: [], parts: [], drawers: [], coins: [], orbs: [], ready: false,
    hc: ctx.heroCell[0], hr: ctx.heroCell[1], bc: ctx.bossCell[0], br: ctx.bossCell[1], bossScale: 1.3 };
  FinalBattle.active = true;
  // Cielo estrellado detrás del tablero (invisible hasta que el suelo se rompe)
  S.sky = document.createElement('div');
  S.sky.className = 'fb-sky';
  for (let i = 0; i < 140; i++) {
    const s = document.createElement('div');
    s.className = 'fb-star';
    s.style.left = rnd(0, 100) + 'vw'; s.style.top = rnd(0, 100) + 'vh';
    s.style.animationDelay = rnd(0, 4) + 's'; s.style.animationDuration = rnd(2, 5) + 's';
    S.sky.appendChild(s);
  }
  document.body.prepend(S.sky);
  S.trash.push(S.sky);
  S.dim = el('div', 'fb-dim');
  S.layer = el('div', 'fb-layer');
  S.flash = el('div', 'fb-flash');
  S.caption = el('div', 'fb-caption');
  startCanvas();

  // La canción del final arranca desde el principio y no para hasta los
  // créditos (que ponen su propia pista)
  if (window.AssetsCache) {
    try {
      const m = JSON.parse(localStorage.getItem('runika-music-pos') || '{}');
      delete m[AssetsCache.MUSIC.fin];
      localStorage.setItem('runika-music-pos', JSON.stringify(m));
    } catch {}
    AssetsCache.setMusicTrack(AssetsCache.MUSIC.fin);
  }

  const DBG = /fbdebug/.test(location.search);
  const log = (p) => { if (!DBG) return; const h = ctx.hero.getBoundingClientRect(), i = ctx.heroImg.getBoundingClientRect(), b = ctx.boss.getBoundingClientRect(); console.log(`FB ${p} hero=${h.left|0},${h.top|0},${h.width|0}x${h.height|0} img=${i.left|0},${i.top|0},${i.width|0}x${i.height|0} op=${getComputedStyle(ctx.heroImg).opacity}/${getComputedStyle(ctx.hero).opacity} vis=${getComputedStyle(ctx.hero).display} boss=${b.left|0},${b.top|0},${b.width|0}`); };
  for (const [n, f] of [['treasure', phaseTreasure], ['rises', phaseBossRises], ['attack', phaseAttack], ['worlds', phaseWorlds], ['clash', phaseClash], ['fall', phaseFall], ['crown', phaseCrown]]) {
    log(n); await f();
  }
  log('end');
}

function onKey(e) {
  if (!S) return;
  if (e.key === 'Escape') { e.preventDefault(); S.ctx.exit(); return; }
  if (!S.ready) return;
  e.preventDefault();
  S.ready = false;
  S.ctx.finish();
}
function onPointer() {
  if (!S || !S.ready) return;
  S.ready = false;
  S.ctx.finish();
}

window.FinalBattle = { run, onKey, onPointer, active: false };
})();
