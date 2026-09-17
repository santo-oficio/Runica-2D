// assets-cache.js — Sistema de cache de assets + transiciones
// Sonidos: fetch + Blob URL + Audio elements (fiable)
// Imagenes: fetch + Blob + object URLs

const ASSETS = {
  images: [
    '/assets/menu principal/menu principal.png',
    '/assets/menu principal/opciones del juego e instrucciones.png',
    '/assets/menu principal/seleccion_personaje.png',
    '/assets/mapamundi/mapamundi.png',
    '/assets/avatars/avatar_01.png',
    '/assets/avatars/avatar_02.png',
    '/assets/avatars/avatar_03.png',
    '/assets/avatars/avatar_04.png',
    '/assets/avatars/avatar_05.png',
    '/assets/avatars/avatar_06.png',
    '/assets/avatars/avatar_07.png',
    '/assets/avatars/avatar_08.png',
    '/assets/enemys/ESPACIO/enemigo_espacio_1900.png',
    '/assets/obstaculos/ESPACIO/losa_03.png',
    '/assets/trampas/AGUA/trampa_01.png',
    '/assets/salida/ESPACIO/salida.png',
  ],
  sounds: [
    '/assets/sounds/comun/menu_mover.wav',
    '/assets/sounds/comun/menu_seleccionar.wav',
    '/assets/sounds/comun/choque.wav',
    '/assets/sounds/comun/trampa.wav',
    '/assets/sounds/comun/pergamino.mp3',
    '/assets/sounds/comun/victoria.mp3',
    '/assets/sounds/comun/derrota.wav',
  ],
};

const cache = {
  images: new Map(),   // url -> blobUrl
  sounds: new Map(),    // url -> blobUrl
};

let loaded = 0;
let total = 0;

async function fetchBlob(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('fetch failed: ' + url);
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

async function preloadImage(url) {
  try {
    const blobUrl = await fetchBlob(url);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = blobUrl;
    });
    cache.images.set(url, blobUrl);
  } catch {}
  loaded++;
}

async function preloadSound(url) {
  try {
    const blobUrl = await fetchBlob(url);
    cache.sounds.set(url, blobUrl);
  } catch (e) {
    console.warn('Error cargando sonido', url, e);
  }
  loaded++;
}

async function preloadAll(onProgress) {
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

function playSound(url, volume) {
  const blobUrl = cache.sounds.get(url);
  if (!blobUrl) return;
  // Crear un Audio nuevo cada vez — fiable, sin cortes
  const audio = new Audio(blobUrl);
  audio.volume = volume ?? 1;
  audio.play().catch(() => {});
}

function unlockAudio() {
  // Reproducir silenciosamente para desbloquear
  const blobUrl = cache.sounds.values().next().value;
  if (blobUrl) {
    const audio = new Audio(blobUrl);
    audio.volume = 0;
    audio.play().then(() => { audio.pause(); }).catch(() => {});
  }
}

// --- Transiciones entre pantallas ---
function transitionTo(url) {
  const overlay = document.getElementById('transition-overlay');
  if (!overlay) { window.location.href = url; return; }
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'auto';
  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    overlay.style.transition = 'opacity 400ms ease';
    overlay.style.opacity = '1';
  });
  setTimeout(() => { window.location.href = url; }, 450);
}

function transitionIn() {
  const overlay = document.getElementById('transition-overlay');
  if (!overlay) return;
  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'auto';
  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    overlay.style.transition = 'opacity 400ms ease';
    overlay.style.opacity = '0';
  });
  setTimeout(() => {
    overlay.style.pointerEvents = 'none';
    overlay.style.display = 'none';
  }, 450);
}

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
  preloadAll, getCachedImage, getCachedImageUrl, getCachedSound, playSound,
  transitionTo, transitionIn, showLoading, hideLoading,
  unlockAudio,
};
