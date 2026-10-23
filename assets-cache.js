// assets-cache.js — Sistema de cache de assets + transiciones
// Sonidos: fetch + Blob URL + Audio elements (fiable)
// Imagenes: fetch + Blob + object URLs

const ASSETS = {
  images: [
    '/assets/menu principal/menu principal.169.webp?v=menu8k-4',
    '/assets/menu principal/seleccion_personaje.169.webp?v=sel8k-4',
    '/assets/mapamundi/mapamundi.16x9.webp?v=mm16-1',
    '/assets/configuracion/configuracion.169.webp?v=cfgq-1',
    '/assets/comunes/modal.webp',
    '/assets/tienda/camino-tienda-house.webp',
    '/assets/tienda/camino-tienda-rung.webp',
    '/assets/tienda/camino-tienda-foot.webp',
    '/assets/avatars/display/avatar_01.webp',
    '/assets/avatars/display/avatar_02.webp',
    '/assets/avatars/display/avatar_03.webp',
    '/assets/avatars/display/avatar_04.webp',
    '/assets/avatars/display/avatar_05.webp',
    '/assets/avatars/display/avatar_06.webp',
    '/assets/avatars/display/avatar_07.webp',
    '/assets/avatars/display/avatar_08.webp',
    '/assets/enemys/display/ESPACIO/enemy_ESPACIO.webp',
    '/assets/obstaculos/display/ESPACIO/cosmic_portal_tile.webp',
    '/assets/trampas/display/AGUA/image_25.webp',
    '/assets/salida/display/ESPACIO/image_20260921_155734.webp',
  ],
  sounds: [
    '/assets/sounds/comun/move.wav',
    '/assets/sounds/comun/hover.wav',
    '/assets/sounds/comun/press.wav',
    '/assets/sounds/comun/back.wav',
    '/assets/sounds/comun/choque.wav',
    '/assets/sounds/comun/trampa.wav',
    '/assets/sounds/comun/derrumbe.mp3',
    '/assets/sounds/comun/pergamino.mp3',
    '/assets/sounds/comun/pulsacion maquina escribir.mp3',
    '/assets/sounds/comun/victoria.wav',
    '/assets/sounds/comun/derrota.wav',
    '/assets/sounds/comun/escalera-crece.wav',
    '/assets/sounds/comun/casa-vuela.wav',
    '/assets/sounds/comun/escalera-encoge.wav',
    '/assets/sounds/comun/escalera-sube.wav',
  ],
};

const cache = {
  images: new Map(),   // url -> blobUrl
  sounds: new Map(),    // url -> blobUrl
  decoded: new Map(),   // url -> Image (mantiene la imagen decodificada en memoria)
};

let loaded = 0;
let total = 0;

// Un fetch/imagen que tarda demasiado no debe colgar la pantalla de carga:
// timeout a todo lo que espere a la red o al decodificador.
const FETCH_TIMEOUT = 30000; // 30s por asset
const IMG_TIMEOUT = 15000;

async function fetchBlob(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!r.ok) throw new Error('fetch failed: ' + url);
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

function timeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function preloadImage(url) {
  try {
    const blobUrl = await fetchBlob(url);
    const img = new Image();
    await timeout(new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = blobUrl;
    }), IMG_TIMEOUT);
    // Solo se decodifica el hot path: los fondos/submundos 8K (~130MB decod.
    // cada uno) quedan como blob en cache y se decodifican al entrar.
    if (DECODE_RE.test(url) && img.decode) {
      // decode() de webp a veces no resuelve nunca: timeout de seguridad
      await timeout(img.decode(), 3000).catch(() => {});
      cache.decoded.set(url, img);
    }
    cache.images.set(url, blobUrl);
  } catch {}
  loaded++;
}

// Decodificar (referencia viva) solo lo que se pinta de inmediato:
// menú, config, modal, avatares display y sprites display.
const DECODE_RE = /\/assets\/(menu principal|configuracion|comunes|instrucciones|creditos|avatars\/display|avatars\/thumbs|.*\/display|fonts)\//;

async function preloadSound(url) {
  try {
    const blobUrl = await fetchBlob(url);
    cache.sounds.set(url, blobUrl);
  } catch (e) {
    console.warn('Error cargando sonido', url, e);
  }
  loaded++;
}

// Trae el manifiesto del servidor (todos los assets runtime) y lo fusiona
// con la lista estática. Así nunca falta un asset por precargar.
async function fetchManifest() {
  try {
    const r = await fetch('/api/assets-manifest');
    if (!r.ok) return;
    const m = await r.json();
    const add = (list, u) => { if (!list.includes(u)) list.push(u); };
    (m.images || []).forEach(u => add(ASSETS.images, u));
    (m.sounds || []).forEach(u => add(ASSETS.sounds, u));
    (m.music || []).forEach(u => add(ASSETS.sounds, u)); // música también precargada
    if (m.music && m.music.length && !musicTrack) {
      musicTrack = m.music.includes(DEFAULT_MUSIC) ? DEFAULT_MUSIC : m.music[0];
    }
  } catch {}
}

// En nativo (Cordova/Tizen/file) los assets ya son locales: precargar el
// manifiesto completo (~300 MB de imágenes 8K + sonidos, retenidos como
// blobs y bitmaps decodificados) agota la RAM del WebView → pantalla
// negra / renderer muerto. En su lugar solo se calientan las <img> que
// la página ya tiene en el DOM y los sonidos quedan para lazy-load
// (playSound cachea al primer uso). Mismo contrato: progreso → reveal
// cuando lo visible está listo.
const IS_NATIVE = typeof window !== 'undefined' && (
  typeof window.cordova !== 'undefined' ||
  typeof window.tizen !== 'undefined' ||
  (typeof location !== 'undefined' && location.protocol === 'file:') ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('runika.tizen') === '1'));

async function preloadAll(onProgress) {
  await fetchManifest();
  if (IS_NATIVE) {
    const urls = [...document.querySelectorAll('img')]
      .map(im => im.currentSrc || im.src || '')
      .filter(src => src.includes('/assets/') && !src.startsWith('blob:') && !src.startsWith('data:'))
      .map(src => { const u = new URL(src, location.href); return u.pathname + u.search; });
    total = urls.length; loaded = 0;
    await Promise.all(urls.map(u => preloadImage(u).then(() => onProgress(loaded, total))));
    return;
  }
  total = ASSETS.images.length + ASSETS.sounds.length;
  loaded = 0;

  const tasks = [
    ...ASSETS.images.map(u => preloadImage(u).then(() => onProgress(loaded, total))),
    ...ASSETS.sounds.map(u => preloadSound(u).then(() => onProgress(loaded, total))),
  ];
  await Promise.all(tasks);
}

function getCachedImageUrl(url) { return cache.images.get(url) ?? url; }
function getCachedImage(url) { return cache.images.get(url); }
function getCachedSound(url) { return cache.sounds.get(url) ?? null; }

// --- Ajustes globales (persisten en db/settings.json via /api/settings) ---
const settings = { sound: true, music: true, lang: 'es' };
// Fuente de apoyo por idioma: ChelseaMarket no cubre CJK ni cirílico, así que
// en ja/zh/ru se añade su fuente manuscrita detrás en la pila (los caracteres
// latinos siguen saliendo con ChelseaMarket, solo los glifos que le faltan
// caen a la fuente del idioma).
const LANG_FONT = { ja: "'Yomogi'", zh: "'MaShanZheng'", ru: "'Caveat'" };
function applyLangFont() {
  document.documentElement.lang = settings.lang || 'es';
  const extra = LANG_FONT[settings.lang];
  let st = document.getElementById('lang-font-fix');
  if (!extra) { if (st) st.remove(); return; }
  if (!st) { st = document.createElement('style'); st.id = 'lang-font-fix'; document.head.appendChild(st); }
  st.textContent = "html *, html *::before, html *::after { font-family: 'ChelseaMarket', " + extra + ", 'Trebuchet MS', cursive, sans-serif !important; }";
}
async function loadSettings() {
  try {
    const r = await fetch('/api/settings');
    if (r.ok) { const d = await r.json(); if (d) Object.assign(settings, d); }
  } catch {}
  applyLangFont();
  const sel = document.getElementById('lang-select');
  if (sel) sel.value = settings.lang;
  return settings;
}
function isSoundEnabled() { return settings.sound !== false; }
function isMusicEnabled() { return settings.music !== false; }
function currentLang() { return settings.lang || 'es'; }
async function setSetting(key, value) {
  settings[key] = value;
  if (key === 'lang') applyLangFont();
  if (key === 'music') { value ? startMusic() : stopMusic(); }
  try {
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });
  } catch {}
}
// La carga arranca sola para que los flags esten listos antes de interactuar
const settingsReady = loadSettings();

// --- Música global: una pista en loop que sigue sonando entre pantallas ---
// La posición se guarda en localStorage POR PISTA para retomar donde se quedó.
const MUSIC_POS_KEY = 'runika-music-pos';
// Tema principal del juego (si está en el manifiesto, manda sobre el resto)
const DEFAULT_MUSIC = '/assets/music/The_Captain_s_Last_Map.mp3';
// Pistas por contexto: main = mapamundi/menus · world = dentro de un mundo
// fin = cinemática final del juego (tras derrotar al boss)
const MUSIC = {
  main: DEFAULT_MUSIC,
  world: '/assets/music/mistery.mp3',
  worldWin: '/assets/music/victoria_mundo.mp3', // derrotar al boss de un mundo
  // ?v= rompe la caché de audio del navegador cuando se reemplaza el mp3
  fin: '/assets/music/victory.mp3?v=134s',
  victoria: '/assets/music/victoria.mp3',  // jingle al ganar una pantalla
  derrota: '/assets/music/derrota.mp3',    // jingle al ser atrapado
  // Pista por submundo: cada mundo tiene su propia música. Si el archivo de
  // un mundo aún no existe, se usa `world` (mistery.mp3) como fallback.
  worlds: {
    ESPACIO: '/assets/music/ESPACIO/submundo.mp3',
    AGUA: '/assets/music/AGUA/submundo.mp3',
    TIERRA: '/assets/music/TIERRA/submundo.mp3',
    FUEGO: '/assets/music/FUEGO/submundo.mp3',
    HIELO: '/assets/music/HIELO/submundo.mp3',
    VIENTO: '/assets/music/VIENTO/submundo.mp3',
    INFRAMUNDO: '/assets/music/INFRAMUNDO/submundo.mp3',
    MAZMORRA: '/assets/music/MAZMORRA/submundo.mp3',
  },
};
// Pista de música de un submundo (fallback a la genérica si falta).
function musicForWorld(world) {
  return MUSIC.worlds[world] || MUSIC.world;
}
// Pistas que suenan UNA sola vez (fanfarrias): no repiten ni en loop.
// El valor es la pista que toma el relevo al terminar — `null` = silencio.
const ONESHOT_MUSIC = new Map([
  [MUSIC.worldWin, MUSIC.main], // fanfarria de boss → tema principal
  // La canción del final (MUSIC.fin) va en LOOP: suena desde la
  // explosión del boss hasta los créditos, que ponen su propia pista
]);
let musicEl = null;
// La pista activa se persiste para que cualquier pantalla retome la
// musica correcta aunque no haya pasado por preloadAll (ej. instrucciones).
const MUSIC_TRACK_KEY = 'runika-music-track';
let musicTrack = null;
try { musicTrack = localStorage.getItem(MUSIC_TRACK_KEY) || null; } catch {}

let lastSavedMusicPos = -1;
function saveMusicPos(force) {
  if (!musicEl || !musicTrack) return;
  // timeupdate dispara ~4 veces/s y localStorage es escritura a disco
  // SINCRONA que bloquea el main thread -> solo persistir cada >=4s.
  if (!force && Math.abs(musicEl.currentTime - lastSavedMusicPos) < 4) return;
  lastSavedMusicPos = musicEl.currentTime;
  try {
    const map = JSON.parse(localStorage.getItem(MUSIC_POS_KEY) || '{}');
    map[musicTrack] = musicEl.currentTime;
    localStorage.setItem(MUSIC_POS_KEY, JSON.stringify(map));
  } catch {}
}
window.addEventListener('beforeunload', () => saveMusicPos(true));

async function startMusic(url) {
  await settingsReady;
  if (!isMusicEnabled()) return;
  url = url || musicTrack;
  if (!url) return;
  if (musicEl) { if (musicEl.paused) musicEl.play().catch(retryMusicOnGesture); return; }
  musicTrack = url;
  try { localStorage.setItem(MUSIC_TRACK_KEY, url); } catch {}
  musicEl = new Audio(getCachedSound(url) || url);
  const oneShot = ONESHOT_MUSIC.has(url);
  musicEl.loop = !oneShot;
  musicEl.volume = 0.45;
  try {
    const map = JSON.parse(localStorage.getItem(MUSIC_POS_KEY) || '{}');
    if (map[url] > 0) musicEl.currentTime = map[url];
  } catch {}
  musicEl.addEventListener('timeupdate', saveMusicPos);
  if (oneShot) {
    // Al acabar la fanfarria: olvida su posición y toma el relevo la
    // pista indicada (o queda en silencio si es null)
    musicEl.addEventListener('ended', () => {
      try {
        const map = JSON.parse(localStorage.getItem(MUSIC_POS_KEY) || '{}');
        delete map[url];
        localStorage.setItem(MUSIC_POS_KEY, JSON.stringify(map));
      } catch {}
      const next = ONESHOT_MUSIC.get(url);
      if (next) setMusicTrack(next);
      else {
        // Sin relevo: la pista muere del todo (un resume posterior no
        // debe levantar una fanfarria ya acabada)
        musicTrack = null;
        try { localStorage.removeItem(MUSIC_TRACK_KEY); } catch {}
      }
    });
  }
  musicEl.play().catch(() => {
    // Autoplay bloqueado (sin gesto previo en este documento — p. ej. una
    // demo con autowin o un enlace directo al tablero): reintenta en el
    // primer gesto del usuario en vez de quedarse muda para siempre.
    retryMusicOnGesture();
  });
}

// Cuando play() es rechazado por la política de autoplay, la pista queda
// "armada": el primer gesto del usuario (clic, tecla, toque) la arranca.
// Si sigue fallando se rearma solo — nunca se queda sin reintento.
let musicRetryArmed = false;
function retryMusicOnGesture() {
  if (musicRetryArmed) return;
  musicRetryArmed = true;
  const retry = () => {
    if (musicEl && musicEl.paused) {
      musicEl.play().catch(() => {
        // Aún bloqueado: rearmar para el siguiente gesto
        ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
          document.addEventListener(ev, retry, { once: true }));
      });
    } else musicRetryArmed = false;
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, retry, { once: true }));
}
// vez y al terminar retoma la pista donde se quedó. Respeta el ajuste
// de música (es música, no un sfx). Al navegar muere con la página como
// el resto del audio.
let stingEl = null;
function stopSting() {
  if (!stingEl) return;
  stingEl.pause();
  stingEl = null;
}
function playMusicSting(url) {
  stopSting();
  if (!isMusicEnabled() || !url) return;
  if (musicEl) { saveMusicPos(true); musicEl.pause(); }
  stingEl = new Audio(getCachedSound(url) || url);
  stingEl.volume = 0.8;
  const done = () => { stingEl = null; startMusic(); };
  stingEl.addEventListener('ended', done);
  stingEl.play().catch(done);
}
// Corta el jingle a mano y reanuda el loop (ej. reintentar/reiniciar
// antes de que el jingle termine — nada de audio suelto sobre el
// puzle nuevo).
function endMusicSting() {
  if (!stingEl) return;
  stopSting();
  startMusic();
}

// Cambia la pista en curso (ej. entrar en un mundo = MUSIC.world).
// Cada pista retoma su propia posición al volver a ella.
function setMusicTrack(url) {
  stopSting();
  if (!url) return;
  // Misma pista: crear el elemento si no existe (página recién cargada) o
  // reanudar el loop si quedó pausado por un jingle cortado
  if (url === musicTrack) { if (!musicEl || musicEl.paused) startMusic(); return; }
  if (musicEl) { saveMusicPos(true); musicEl.pause(); musicEl = null; }
  musicTrack = url;
  try { localStorage.setItem(MUSIC_TRACK_KEY, url); } catch {}
  startMusic();
}

// La pista activa (persistida en localStorage — válida también en una
// página recién cargada que aún no ha creado su <audio>).
function currentMusicTrack() { return musicTrack; }

function stopMusic() {
  stopSting();
  if (!musicEl) return;
  saveMusicPos(true);
  musicEl.pause();
  musicEl = null;
}

// Precarga ligera de sonidos sueltos (sin el manifiesto completo)
async function preloadSounds(urls) {
  await Promise.all((urls || []).map(async (u) => {
    try {
      if (!cache.sounds.has(u)) {
        const res = await fetch(u);
        if (res.ok) cache.sounds.set(u, URL.createObjectURL(await res.blob()));
      }
    } catch {}
  }));
}

// Mismo sfx a <100ms se ignora: la repeticion de tecla del mando (DPAD
// sostenido ~10-15/s) no debe amontonar decoders de Audio por pulsacion.
const lastPlayAt = new Map();
function playSound(url, volume) {
  if (!isSoundEnabled()) return null;
  const now = performance.now();
  if (now - (lastPlayAt.get(url) || -1e9) < 100) return null;
  lastPlayAt.set(url, now);
  let src = cache.sounds.get(url);
  if (!src) {
    // Fuera de precarga: sonar igual y cachear para la proxima vez
    src = url;
    preloadSound(url);
  }
  // Crear un Audio nuevo cada vez — fiable, sin cortes
  const audio = new Audio(src);
  audio.volume = volume ?? 1;
  audio.play().catch(() => {});
  return audio;
}

function unlockAudio(withMusic = true) {
  // Reproducir silenciosamente para desbloquear
  const blobUrl = cache.sounds.values().next().value;
  if (blobUrl) {
    const audio = new Audio(blobUrl);
    audio.volume = 0;
    audio.play().then(() => { audio.pause(); }).catch(() => {});
  }
  // La música arranca tras el primer gesto del usuario (autoplay policy)
  if (withMusic) startMusic();
}

// Aura irregular determinista a partir de un circulo calibrado {cx,cy,r}.
// cx,cy,r en fracciones del ancho de imagen; seed = nombre del mundo
// (misma forma siempre para el mismo mundo). aspect = w/h de la imagen.
function auraPoints(cx, cy, r, seed, aspect) {
  let h = 2166136261;
  const s = String(seed || 'aura');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = () => { h = (Math.imul(h ^ (h >>> 15), 2246822519) >>> 0) ^ Math.imul(h ^ (h >>> 13), 3266489917); h >>>= 0; return h / 4294967296; };
  const ry = r * (aspect || 1.5);
  const pts = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + (rnd() - 0.5) * 0.24;
    const jr = 1 + (rnd() - 0.5) * 0.55;
    pts.push([cx + Math.cos(ang) * r * jr, cy + Math.sin(ang) * ry * jr]);
  }
  return pts;
}

// Rasteriza UNA vez una capa "imagen + máscara de blobs + filter" en un
// canvas. En WebViews sin compositor de capas (Fire TV/Chromium de Amazon)
// un div con mask-image+filter se re-rasteriza ENTERO por cada repaint del
// área dañada — ~30ms por frame a pantalla completa → todo va a saltos. El
// canvas horneado solo se blitea: el mismo resultado a coste casi nulo.
// blobs: [{x,y,rx,ry,s,f}] en px del rect de la capa — equivalen a
// radial-gradient(ellipse rx ry at x y, #000 s%, transparent f%).
function bakeMaskedLayer(img, w, h, blobs, filterCss) {
  const cw = Math.max(1, Math.round(w)), ch = Math.max(1, Math.round(h));
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  if (!('filter' in ctx)) return null; // WebView vieja: caer al div mask+filter
  ctx.filter = filterCss;
  ctx.drawImage(img, 0, 0, cw, ch);
  ctx.filter = 'none';
  const mc = document.createElement('canvas');
  mc.width = cw; mc.height = ch;
  const mctx = mc.getContext('2d');
  for (const b of blobs) {
    const rx = b.rx, ry = b.ry ?? b.rx;
    mctx.save();
    mctx.translate(b.x, b.y);
    mctx.scale(1, ry / rx);
    const grad = mctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(Math.min(1, b.s / 100), 'rgba(0,0,0,1)');
    grad.addColorStop(Math.min(1, b.f / 100), 'rgba(0,0,0,0)');
    mctx.fillStyle = grad;
    mctx.beginPath();
    mctx.arc(0, 0, rx, 0, Math.PI * 2);
    mctx.fill();
    mctx.restore();
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mc, 0, 0);
  return cv;
}

// --- Transiciones entre pantallas ---
function transitionTo(url) {
  const overlay = document.getElementById('transition-overlay');
  if (!overlay) { window.location.href = url; return; }
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'auto';
  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    overlay.style.transition = 'opacity 260ms ease';
    overlay.style.opacity = '1';
  });
  setTimeout(() => { window.location.href = url; }, 300);
}

function transitionIn() {
  const overlay = document.getElementById('transition-overlay');
  if (!overlay) return;
  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'auto';
  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    overlay.style.transition = 'opacity 260ms ease';
    overlay.style.opacity = '0';
  });
  setTimeout(() => {
    overlay.style.pointerEvents = 'none';
    overlay.style.display = 'none';
  }, 300);
}

// Revelado de página: funde la pantalla de carga y el overlay A LA VEZ.
// Si el loading se funde antes y el overlay sigue opaco debajo, aparece
// un latigazo de negro puro entre ambos — las dos capas deben caer juntas.
function revealPage() {
  transitionIn();
  hideLoading();
}

// Watchdog: las páginas nacen con el overlay en negro (cero destello entre
// navegaciones). Si por un error/hang nadie llamó a transitionIn, liberar la
// pantalla pasado un margen generoso — negro eterno es peor que revelar.
setTimeout(() => {
  const overlay = document.getElementById('transition-overlay');
  if (overlay && parseFloat(getComputedStyle(overlay).opacity) > 0.5) transitionIn();
}, 25000);

// --- Pantalla de carga ---
function showLoading() {
  const loader = document.getElementById('loading-screen');
  if (loader) loader.style.display = 'flex';
}

function hideLoading() {
  const loader = document.getElementById('loading-screen');
  if (loader) {
    loader.style.transition = 'opacity 400ms ease';
    loader.style.opacity = '0';
    setTimeout(() => { loader.style.display = 'none'; }, 450);
  }
}

window.AssetsCache = {
  preloadAll, preloadSounds, getCachedImage, getCachedImageUrl, getCachedSound, playSound, auraPoints, bakeMaskedLayer,
  transitionTo, transitionIn, revealPage, showLoading, hideLoading,
  unlockAudio,
  settings, loadSettings, setSetting, isSoundEnabled, isMusicEnabled, currentLang,
  startMusic, stopMusic, setMusicTrack, playMusicSting, endMusicSting, MUSIC, musicForWorld, currentMusicTrack,
};
